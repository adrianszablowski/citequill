import { describe, expect, it } from 'vitest';

import {
    agentsBlocked,
    aiSearchAgents,
    aiTrainingAgents,
    aiUserAgents,
    blockedBy,
    cdnTestAgents,
    googlebotBlocks,
    parseRobots,
    robotsFile,
} from '@/features/audit/robots';
import { chromeVersion, userAgent } from '@/features/crawl/fetch';

const robotsUrl = 'https://acme.com/robots.txt';

function file(text: string) {
    return robotsFile(robotsUrl, {
        ok: true,
        status: 200,
        hops: [],
        body: text,
    });
}

describe('parseRobots', () => {
    it('keeps every group with its agents and directives and every Sitemap line', () => {
        const parsed = parseRobots(
            [
                'User-agent: Googlebot',
                'User-agent: Bingbot',
                'Disallow: /private # staff only',
                '',
                'User-agent: *',
                'Crawl-delay: 5',
                'Content-Signal: search=yes',
                'Sitemap: https://acme.com/sitemap.xml',
            ].join('\n'),
        );

        expect(parsed.groups).toEqual([
            {
                agents: ['Googlebot', 'Bingbot'],
                rules: [{ directive: 'disallow', value: '/private', line: 3 }],
            },
            {
                agents: ['*'],
                rules: [
                    { directive: 'crawl-delay', value: '5', line: 6 },
                    {
                        directive: 'content-signal',
                        value: 'search=yes',
                        line: 7,
                    },
                ],
            },
        ]);

        expect(parsed.sitemaps).toEqual(['https://acme.com/sitemap.xml']);
    });
});

describe('robotsFile', () => {
    it('restricts nothing when robots.txt answers 4xx, 5xx or not at all, and records the answer', () => {
        const missing = robotsFile(robotsUrl, {
            ok: false,
            status: 404,
            hops: [{ url: robotsUrl, status: 404 }],
            body: 'User-agent: *\nDisallow: /',
        });

        const down = robotsFile(robotsUrl, {
            ok: false,
            status: 503,
            hops: [{ url: robotsUrl, status: 503 }],
            body: '',
        });

        expect(missing).toMatchObject({ status: 404, groups: [] });
        expect(down).toMatchObject({ status: 503, groups: [] });
        expect(robotsFile(robotsUrl, null)).toMatchObject({ status: null });

        const isBlocked = blockedBy([missing], true);

        expect(isBlocked('https://acme.com/anything')).toBe(false);
    });
});

describe('blockedBy', () => {
    it('applies the Googlebot group when there is one, else the * group', () => {
        const withGooglebot = blockedBy(
            [
                file(
                    'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /private',
                ),
            ],
            true,
        );

        expect(withGooglebot('https://acme.com/pricing')).toBe(false);
        expect(withGooglebot('https://acme.com/private/a')).toBe(true);

        const withStar = blockedBy(
            [file('User-agent: *\nDisallow: /admin')],
            true,
        );

        expect(withStar('https://acme.com/admin/users')).toBe(true);
        expect(withStar('https://acme.com/pricing')).toBe(false);
    });

    it('lets the longest rule win and an allow win a tie', () => {
        const isBlocked = blockedBy(
            [
                file(
                    'User-agent: *\nDisallow: /shop\nAllow: /shop/public\nDisallow: /*.pdf$\nAllow: /*.pdf$',
                ),
            ],
            true,
        );

        expect(isBlocked('https://acme.com/shop/cart')).toBe(true);
        expect(isBlocked('https://acme.com/shop/public/a')).toBe(false);
        expect(isBlocked('https://acme.com/guide.pdf')).toBe(false);
    });

    it('honours a CitequillBot group always, and only that group when robots.txt is not obeyed', () => {
        const robots = [
            file(
                'User-agent: *\nDisallow: /\n\nUser-agent: CitequillBot\nDisallow: /cart',
            ),
        ];

        expect(blockedBy(robots, false)('https://acme.com/pricing')).toBe(
            false,
        );

        expect(blockedBy(robots, false)('https://acme.com/cart')).toBe(true);
        expect(blockedBy(robots, true)('https://acme.com/pricing')).toBe(true);

        const withoutOwnGroup = [file('User-agent: *\nDisallow: /')];

        expect(
            blockedBy(withoutOwnGroup, false)('https://acme.com/pricing'),
        ).toBe(false);
    });

    it('applies the rules of a group with an empty user-agent line to no crawler, not to the group before', () => {
        const robots = [
            file(
                'User-agent: *\nDisallow: /private\n\nUser-agent:\nDisallow: /',
            ),
        ];

        expect(blockedBy(robots, true)('https://acme.com/')).toBe(false);

        expect(blockedBy(robots, true)('https://acme.com/private/a')).toBe(
            true,
        );

        expect(googlebotBlocks(robots)('https://acme.com/')).toBe(false);
    });

    it('applies a file only to its own host', () => {
        const isBlocked = blockedBy([file('User-agent: *\nDisallow: /')], true);

        expect(isBlocked('https://acme.de/pricing')).toBe(false);
    });

    it('blocks a URL on a www twin or over http by the file of its own origin', () => {
        const isBlocked = blockedBy(
            ['https://www.acme.com', 'http://acme.com'].map((origin) =>
                robotsFile(`${origin}/robots.txt`, {
                    ok: true,
                    status: 200,
                    hops: [],
                    body: 'User-agent: *\nDisallow: /private',
                }),
            ),
            true,
        );

        expect(isBlocked('https://www.acme.com/private/a')).toBe(true);
        expect(isBlocked('http://acme.com/private/a')).toBe(true);
        expect(isBlocked('http://acme.com/pricing')).toBe(false);
    });
});

describe('googlebotBlocks', () => {
    it('answers for Googlebot alone, whatever the CitequillBot group says', () => {
        const isBlocked = googlebotBlocks([
            file(
                'User-agent: Googlebot\nDisallow: /private\n\nUser-agent: CitequillBot\nDisallow: /cart',
            ),
        ]);

        expect(isBlocked('https://acme.com/private/a')).toBe(true);
        expect(isBlocked('https://acme.com/cart')).toBe(false);
        expect(isBlocked('https://acme.de/private/a')).toBe(false);
    });
});

describe('agentsBlocked', () => {
    const home = 'https://acme.com/';

    it('reads every agent of the three lists from its own group', () => {
        for (const agent of [
            ...aiSearchAgents,
            ...aiTrainingAgents,
            ...aiUserAgents,
        ]) {
            const blocked = agentsBlocked(
                [file(`User-agent: ${agent}\nDisallow: /`)],
                [...aiSearchAgents, ...aiTrainingAgents, ...aiUserAgents],
            );

            expect(blocked(home), agent).toEqual([agent]);
        }
    });

    it('matches a group in any case', () => {
        expect(
            agentsBlocked(
                [file('User-agent: oai-searchbot\nDisallow: /')],
                aiSearchAgents,
            )(home),
        ).toEqual(['OAI-SearchBot']);
    });

    it('falls back to the * group for an agent with no group of its own', () => {
        expect(
            agentsBlocked(
                [file('User-agent: *\nDisallow: /')],
                aiTrainingAgents,
            )(home),
        ).toEqual(aiTrainingAgents);
    });

    it('lets a group that allows an agent win over a * group that disallows', () => {
        const blocked = agentsBlocked(
            [
                file(
                    'User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nUser-agent: Bingbot\nAllow: /',
                ),
            ],
            aiSearchAgents,
        );

        expect(blocked(home)).not.toContain('OAI-SearchBot');
        expect(blocked(home)).not.toContain('Bingbot');
        expect(blocked(home)).toContain('PerplexityBot');
    });

    it('reads Applebot and Amzn-SearchBot through the Googlebot group when no group names them, and through * only when there is no Googlebot group', () => {
        const followers = ['Applebot', 'Amzn-SearchBot'];

        const withGooglebot = agentsBlocked(
            [
                file(
                    'User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /',
                ),
            ],
            aiSearchAgents,
        );

        expect(withGooglebot(home)).not.toContain('Applebot');
        expect(withGooglebot(home)).not.toContain('Amzn-SearchBot');
        expect(withGooglebot(home)).toContain('OAI-SearchBot');

        const googlebotBlocked = agentsBlocked(
            [file('User-agent: Googlebot\nDisallow: /')],
            aiSearchAgents,
        );

        expect(googlebotBlocked(home)).toEqual(followers);

        const ownGroups = agentsBlocked(
            [
                file(
                    'User-agent: Googlebot\nDisallow: /\n\nUser-agent: Applebot\nUser-agent: amzn-searchbot\nAllow: /',
                ),
            ],
            aiSearchAgents,
        );

        expect(ownGroups(home)).toEqual([]);

        const starOnly = agentsBlocked(
            [file('User-agent: *\nDisallow: /')],
            followers,
        );

        expect(starOnly(home)).toEqual(followers);
    });

    it('reads Google-Extended among the search agents, from its own group or *', () => {
        expect(
            agentsBlocked(
                [file('User-agent: Google-Extended\nDisallow: /')],
                aiSearchAgents,
            )(home),
        ).toEqual(['Google-Extended']);

        expect(
            agentsBlocked(
                [file('User-agent: Google-Extended\nDisallow: /')],
                aiTrainingAgents,
            )(home),
        ).toEqual([]);
    });

    it('reads a named group whose only lines Google ignores as allowing everything, not as the * group', () => {
        const blocked = agentsBlocked(
            [
                file(
                    'User-agent: OAI-SearchBot\nContent-Signal: search=yes\n\nUser-agent: Applebot\nCrawl-delay: 5\n\nUser-agent: *\nDisallow: /',
                ),
            ],
            aiSearchAgents,
        );

        expect(blocked(home)).not.toContain('OAI-SearchBot');
        expect(blocked(home)).not.toContain('Applebot');
        expect(blocked(home)).toContain('PerplexityBot');
    });

    it('fails only the pages under a partial disallow', () => {
        const blocked = agentsBlocked(
            [file('User-agent: PerplexityBot\nDisallow: /private/')],
            aiSearchAgents,
        );

        expect(blocked('https://acme.com/private/a')).toEqual([
            'PerplexityBot',
        ]);

        expect(blocked('https://acme.com/pricing')).toEqual([]);
    });

    it('blocks nothing with a file of no groups, or on an origin with no robots.txt', () => {
        expect(agentsBlocked([file('')], aiSearchAgents)(home)).toEqual([]);

        expect(
            agentsBlocked(
                [file('User-agent: *\nDisallow: /')],
                aiSearchAgents,
            )('https://acme.de/'),
        ).toEqual([]);

        expect(agentsBlocked([], aiSearchAgents)(home)).toEqual([]);
    });
});

describe('cdnTestAgents', () => {
    it('sends every AI search agent but Bingbot and Google-Extended, in the order of the search agents', () => {
        expect(cdnTestAgents.map(({ agent }) => agent)).toEqual(
            aiSearchAgents.filter(
                (agent) => agent !== 'Bingbot' && agent !== 'Google-Extended',
            ),
        );
    });

    it("names each agent's own token and ends with the bot's name", () => {
        for (const { agent, userAgent: sent } of cdnTestAgents) {
            expect(sent, agent).toContain(agent);
            expect(sent.endsWith(` ${userAgent}`), agent).toBe(true);
        }
    });

    it("sends Claude-SearchBot's token alone, and the Chrome version of the browser control where Amazon writes W.X.Y.Z", () => {
        const sent = new Map(
            cdnTestAgents.map(({ agent, userAgent: value }) => [agent, value]),
        );

        expect(sent.get('Claude-SearchBot')).toBe(
            `Claude-SearchBot ${userAgent}`,
        );

        expect(sent.get('Amzn-SearchBot')).toContain(
            `Chrome/${chromeVersion} Safari/537.36`,
        );

        expect(sent.get('Amzn-SearchBot')).not.toContain('W.X.Y.Z');
    });
});

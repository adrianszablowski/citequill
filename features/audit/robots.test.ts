import { describe, expect, it } from 'vitest';

import { blockedBy, parseRobots, robotsFile } from '@/features/audit/robots';

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

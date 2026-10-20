import { describe, expect, it } from 'vitest';

import { robotsByteCap, robotsChecks } from '@/features/audit/robots-checks';
import { robotsFile } from '@/features/audit/robots';

const homes = ['https://acme.com/', 'https://acme.com/de/'];

function file(url: string, status: number | null, body = '', redirects = 0) {
    return robotsFile(
        url,
        status === null
            ? null
            : {
                  ok: status === 200,
                  status,
                  hops: Array.from({ length: redirects + 1 }, () => ({
                      url,
                      status,
                  })),
                  body,
                  bytes: Buffer.byteLength(body),
              },
    );
}

function checks(...files: ReturnType<typeof file>[]) {
    return robotsChecks(files, homes).map((finding) => finding.check);
}

describe('robotsChecks', () => {
    it('finds nothing in a plain robots.txt', () => {
        expect(
            checks(
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: *\nDisallow: /admin',
                ),
            ),
        ).toEqual([]);
    });

    it('reports a 5xx or no answer at a home origin, and a 4xx as a hint', () => {
        expect(checks(file('https://acme.com/robots.txt', 503))).toEqual([
            'robots-5xx',
        ]);

        expect(checks(file('https://acme.com/robots.txt', null))).toEqual([
            'robots-5xx',
        ]);

        expect(checks(file('https://acme.com/robots.txt', 404))).toEqual([
            'robots-4xx',
        ]);
    });

    it('reads only the robots.txt of the origins the home pages are on, so a twin host with nothing on it is no finding', () => {
        expect(
            checks(
                file('http://www.acme.com/robots.txt', null),
                file('https://acme.com/robots.txt', 200, 'User-agent: *'),
            ),
        ).toEqual([]);
    });

    it('reports a file over 500 KiB or behind more than 5 redirects', () => {
        expect(
            checks(
                file(
                    'https://acme.com/robots.txt',
                    200,
                    `User-agent: *\n#${'x'.repeat(robotsByteCap)}`,
                ),
            ),
        ).toEqual(['robots-size']);

        expect(
            checks(
                file('https://acme.com/robots.txt', 200, 'User-agent: *', 6),
            ),
        ).toEqual(['robots-size']);

        expect(
            checks(
                file('https://acme.com/robots.txt', 200, 'User-agent: *', 5),
            ),
        ).toEqual([]);
    });

    it('names the lines Google ignores', () => {
        const [finding] = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: *\nCrawl-delay: 10\nHost: acme.com\nDisallow: /x',
                ),
            ],
            homes,
        );

        expect(finding).toMatchObject({
            check: 'robots-unsupported',
            url: null,
            subject: 'https://acme.com/robots.txt',
            snippet: 'crawl-delay: 10',
            detail: { lines: [2, 3] },
        });
    });

    it('fails the gate for every home page Googlebot may not fetch, through its own group or the * group', () => {
        const blocked = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: Googlebot\nDisallow: /de/',
                ),
            ],
            homes,
        );

        expect(blocked).toEqual([
            {
                check: 'robots-googlebot-blocked',
                url: null,
                subject: 'https://acme.com/de/',
            },
        ]);

        expect(
            checks(
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: *\nDisallow: /',
                ),
            ),
        ).toEqual([
            'robots-googlebot-blocked',
            'robots-googlebot-blocked',
            'ai-training-bots-blocked',
            'ai-training-bots-blocked',
            'ai-user-agents-blocked',
            'ai-user-agents-blocked',
        ]);

        expect(
            checks(
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: CitequillBot\nDisallow: /',
                ),
            ),
        ).toEqual([]);
    });

    it('passes the gate when an empty user-agent line starts a group that disallows everything', () => {
        expect(
            checks(
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: *\nDisallow: /private\n\nUser-agent:\nDisallow: /',
                ),
            ),
        ).toEqual([]);
    });

    it('passes the gate and blocks no agent of its own group when that group holds only a Content-Signal line', () => {
        expect(
            checks(
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: Googlebot\nUser-agent: GPTBot\nContent-Signal: ai-train=no\n\nUser-agent: *\nDisallow: /',
                ),
            ).filter((id) => id !== 'content-signals'),
        ).toEqual([
            'ai-training-bots-blocked',
            'ai-training-bots-blocked',
            'ai-user-agents-blocked',
            'ai-user-agents-blocked',
        ]);

        const [training] = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: Googlebot\nUser-agent: GPTBot\nContent-Signal: ai-train=no\n\nUser-agent: *\nDisallow: /',
                ),
            ],
            homes,
        ).filter(({ check }) => check === 'ai-training-bots-blocked');

        expect(training.detail).toEqual({
            agents: [
                'ClaudeBot',
                'Meta-ExternalAgent',
                'Applebot-Extended',
                'MistralAI-Training',
                'Amazonbot',
                'CCBot',
            ],
        });
    });

    it('judges each home page by the robots.txt of its own origin', () => {
        const findings = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: GPTBot\nDisallow: /',
                ),
                file(
                    'https://acme.de/robots.txt',
                    200,
                    'User-agent: Perplexity-User\nDisallow: /',
                ),
            ],
            ['https://acme.com/', 'https://acme.de/'],
        );

        expect(findings).toEqual([
            {
                check: 'ai-training-bots-blocked',
                url: null,
                subject: 'https://acme.com/',
                detail: { agents: ['GPTBot'] },
            },
            {
                check: 'ai-user-agents-blocked',
                url: null,
                subject: 'https://acme.de/',
                detail: { agents: ['Perplexity-User'] },
            },
        ]);
    });

    it('hints at AI training and user-fetch agents blocked from a home page, one finding per home naming the agents', () => {
        const findings = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: ChatGPT-User\nDisallow: /de/',
                ),
            ],
            homes,
        );

        expect(findings).toEqual([
            {
                check: 'ai-training-bots-blocked',
                url: null,
                subject: 'https://acme.com/',
                detail: { agents: ['GPTBot', 'CCBot'] },
            },
            {
                check: 'ai-training-bots-blocked',
                url: null,
                subject: 'https://acme.com/de/',
                detail: { agents: ['GPTBot', 'CCBot'] },
            },
            {
                check: 'ai-user-agents-blocked',
                url: null,
                subject: 'https://acme.com/de/',
                detail: { agents: ['ChatGPT-User'] },
            },
        ]);
    });

    it('notes a Content-Signal line with the field in any case, once per file, each value as written with the agents of its groups', () => {
        const [finding] = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-Agent: *\nContent-signal: search=yes, ai-train=no, use=reference\nAllow: /\n\nUser-agent: Googlebot\nUser-agent: Bingbot\nContent-Signal: ai-input=no',
                ),
            ],
            homes,
        );

        expect(finding).toEqual({
            check: 'content-signals',
            url: null,
            subject: 'https://acme.com/robots.txt',
            detail: {
                signals: [
                    'search=yes, ai-train=no, use=reference (*)',
                    'ai-input=no (Googlebot, Bingbot)',
                ],
            },
        });
    });

    it('pairs each value with the agents of every group that carries it, as Cloudflare writes niebezpiecznik.pl', () => {
        const [finding] = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    [
                        'User-agent: *',
                        'Content-Signal: search=yes,ai-train=no',
                        'Allow: /',
                        '',
                        'User-agent: Applebot-Extended',
                        'Allow: /',
                        'Content-Signal: ai-train=no,ai-input=yes,search=yes',
                        '',
                        'User-agent: CCBot',
                        'Disallow: /',
                        '',
                        'User-agent: Google-Extended',
                        'User-agent: Google-InspectionTool',
                        'Allow: /',
                        'Content-Signal: ai-train=no,ai-input=yes,search=yes',
                    ].join('\n'),
                ),
            ],
            homes,
        );

        expect(finding.detail).toEqual({
            signals: [
                'search=yes,ai-train=no (*)',
                'ai-train=no,ai-input=yes,search=yes (Applebot-Extended, Google-Extended, Google-InspectionTool)',
            ],
        });
    });

    it('shows a Content-Signal line before any User-agent as having no agent', () => {
        const [finding] = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'Content-Signal: ai-train=no\n\nUser-agent: *\nAllow: /',
                ),
            ],
            homes,
        );

        expect(finding).toMatchObject({
            check: 'content-signals',
            detail: { signals: ['ai-train=no (no User-agent)'] },
        });
    });

    it('lists a signal written alike in several groups once', () => {
        const [finding] = robotsChecks(
            [
                file(
                    'https://acme.com/robots.txt',
                    200,
                    'User-agent: *\nContent-Signal: search=yes, ai-train=yes\n\nUser-agent: GPTBot\nContent-Signal: search=yes, ai-train=yes',
                ),
            ],
            homes,
        );

        expect(finding.detail).toEqual({
            signals: ['search=yes, ai-train=yes (*, GPTBot)'],
        });
    });

    it('reads Content Signals only in the robots.txt of the home origins', () => {
        expect(
            checks(
                file(
                    'https://www.acme.com/robots.txt',
                    200,
                    'User-agent: *\nContent-Signal: ai-train=no',
                ),
            ),
        ).toEqual([]);
    });
});

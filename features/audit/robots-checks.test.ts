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
        ).toEqual(['robots-googlebot-blocked', 'robots-googlebot-blocked']);

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
});

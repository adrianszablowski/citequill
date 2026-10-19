import { describe, expect, it } from 'vitest';

import {
    contentPathPrefixes,
    contentPaths,
    hostVariants,
    judgeHttpTwin,
    judgeMissingPath,
    judgeStaging,
    judgeVariant,
    linkedHostCap,
    linkedHosts,
    randomPathTargets,
    randomPathToken,
    stagingHosts,
} from '@/features/audit/probes';
import { type QueueEntry, siteHosts } from '@/features/audit/queue';
import { googlebotBlocks, robotsFile } from '@/features/audit/robots';
import type { Fetched, Hop } from '@/features/crawl/fetch';

const hosts = siteHosts('acme.com', ['https://acme.com']);
const homes = ['https://acme.com'];

function answer(hops: Hop[], { body = '', headers = {} } = {}): Fetched {
    const last = hops.at(-1)!;

    return {
        ok: last.status < 400,
        status: last.status,
        url: last.url,
        headers: new Headers(headers),
        body,
        isTruncated: false,
        hops,
        headersMs: 0,
    };
}

function disallowing(robotsTxt: string) {
    return googlebotBlocks([
        robotsFile('https://acme.com/robots.txt', {
            ok: true,
            status: 200,
            hops: [],
            body: robotsTxt,
        }),
    ]);
}

const blocksAll = () => true;

function entry(
    url: string,
    state: QueueEntry['state'],
    depth: number | null = 1,
): QueueEntry {
    return {
        url,
        depth,
        state,
        in_sitemap: false,
        inbound_links: 1,
        linked_from: [],
        alternates: null,
    };
}

describe('randomPathToken', () => {
    it('is 24 lowercase letters and digits, new each time', () => {
        const token = randomPathToken();

        expect(token).toMatch(/^[a-z0-9]{24}$/);
        expect(randomPathToken()).not.toBe(token);
    });
});

describe('randomPathTargets', () => {
    it('asks the https origin of every host and every base URL once, slashes normalised', () => {
        expect(
            randomPathTargets(
                hosts,
                [
                    'https://acme.com',
                    'https://acme.com/de/',
                    'https://Acme.com/de',
                ],
                'abc',
            ),
        ).toEqual([
            { base: 'https://acme.com', url: 'https://acme.com/abc' },
            { base: 'https://www.acme.com', url: 'https://www.acme.com/abc' },
            { base: 'https://acme.com/de', url: 'https://acme.com/de/abc' },
        ]);
    });
});

describe('judgeMissingPath', () => {
    const base = 'https://acme.com';
    const probed = `${base}/abc`;

    const judged = (fetched: Fetched) =>
        judgeMissingPath(fetched, base, homes, hosts);

    it('reads a missing path that ends on 200 away from a home page as a soft 404 on its base, the probed URL in the detail', () => {
        expect(
            judged(
                answer([
                    { url: probed, status: 302 },
                    { url: 'https://acme.com/sorry', status: 200 },
                ]),
            ),
        ).toEqual({
            check: 'soft-404',
            url: null,
            subject: base,
            detail: {
                reason: 'probe',
                url: probed,
                status: 200,
                finalUrl: 'https://acme.com/sorry',
            },
        });

        expect(judged(answer([{ url: probed, status: 200 }]))).toMatchObject({
            check: 'soft-404',
            subject: base,
        });
    });

    it('reads a missing path that ends on a home page as a redirect to home, whatever the home answers', () => {
        for (const status of [200, 503]) {
            expect(
                judged(
                    answer([
                        { url: probed, status: 301 },
                        { url: 'https://acme.com/', status },
                    ]),
                ),
            ).toEqual({
                check: 'redirect-to-home',
                url: null,
                subject: base,
                detail: {
                    reason: 'probe',
                    url: probed,
                    status,
                    finalUrl: 'https://acme.com/',
                },
            });
        }
    });

    it('counts the root of every site host as a home, so a missing path on www that lands on the www root redirects to home', () => {
        const www = 'https://www.acme.com';

        expect(
            judgeMissingPath(
                answer([
                    { url: `${www}/abc`, status: 301 },
                    { url: `${www}/`, status: 200 },
                ]),
                www,
                homes,
                hosts,
            ),
        ).toMatchObject({ check: 'redirect-to-home', subject: www });
    });

    it('reads a home with or without its trailing slash as the same home', () => {
        const de = 'https://acme.com/de';

        for (const [home, finalUrl] of [
            [de, `${de}/`],
            [`${de}/`, de],
        ]) {
            expect(
                judgeMissingPath(
                    answer([
                        { url: `${de}/abc`, status: 302 },
                        { url: finalUrl, status: 200 },
                    ]),
                    de,
                    [home],
                    hosts,
                ),
            ).toMatchObject({ check: 'redirect-to-home' });
        }
    });

    it('finds nothing in a real 404 or 410, or in a redirect that ends on one', () => {
        expect(judged(answer([{ url: probed, status: 404 }]))).toBeNull();

        expect(
            judged(
                answer([
                    { url: probed, status: 301 },
                    { url: 'https://acme.com/gone', status: 410 },
                ]),
            ),
        ).toBeNull();
    });
});

describe('hostVariants', () => {
    it('gives the twin host, the slash toggled, the last segment capitalised and the http twin', () => {
        expect(hostVariants('https://acme.com/blog/post?x=1')).toEqual([
            { url: 'https://www.acme.com/blog/post?x=1', variant: 'www' },
            { url: 'https://acme.com/blog/post/?x=1', variant: 'slash' },
            { url: 'https://acme.com/blog/Post?x=1', variant: 'case' },
            { url: 'http://acme.com/blog/post?x=1', variant: 'http' },
        ]);

        expect(hostVariants('https://www.acme.com/about/')).toEqual([
            { url: 'https://acme.com/about/', variant: 'www' },
            { url: 'https://www.acme.com/about', variant: 'slash' },
            { url: 'https://www.acme.com/About/', variant: 'case' },
            { url: 'http://www.acme.com/about/', variant: 'http' },
        ]);
    });

    it('gives an http URL no http twin', () => {
        expect(
            hostVariants('http://acme.com/about').map(({ variant }) => variant),
        ).toEqual(['www', 'slash', 'case']);
    });

    it('skips a variant equal to the original: the slash and case of a root, a segment with no letter or one already capitalised', () => {
        expect(hostVariants('https://acme.com/')).toEqual([
            { url: 'https://www.acme.com/', variant: 'www' },
            { url: 'http://acme.com/', variant: 'http' },
        ]);

        expect(
            hostVariants('https://acme.com/2026').map(({ variant }) => variant),
        ).toEqual(['www', 'slash', 'http']);

        expect(
            hostVariants('https://acme.com/About').map(
                ({ variant }) => variant,
            ),
        ).toEqual(['www', 'slash', 'http']);
    });

    it('capitalises the first plain letter after digits and percent escapes, never a hex digit of an escape', () => {
        expect(hostVariants('https://acme.com/12-%c3%b3w-ab').at(2)).toEqual({
            url: 'https://acme.com/12-%c3%b3W-ab',
            variant: 'case',
        });
    });
});

describe('judgeVariant', () => {
    const page = 'https://acme.com/a';
    const variant = { url: 'https://acme.com/A', variant: 'case' as const };

    const answering = (canonical: string) =>
        answer([{ url: variant.url, status: 200 }], {
            body: `<head><link rel="canonical" href="${canonical}"></head>`,
        });

    it('reports a variant that answers 200 without redirecting and with no canonical, on the page', () => {
        expect(
            judgeVariant(
                page,
                variant,
                answer([{ url: variant.url, status: 200 }]),
            ),
        ).toEqual({
            check: 'host-variants',
            url: page,
            subject: variant.url,
            detail: { variant: 'case', status: 200 },
        });
    });

    it('reports a variant whose canonical names the variant itself', () => {
        expect(
            judgeVariant(page, variant, answering(variant.url)),
        ).toMatchObject({ check: 'host-variants', subject: variant.url });
    });

    it('finds nothing when the canonical names the original URL, absolute, relative to the variant or in the Link header', () => {
        for (const fetched of [
            answering(page),
            answering('/a'),
            answer([{ url: variant.url, status: 200 }], {
                headers: { link: '</a>; rel="canonical"' },
            }),
        ]) {
            expect(judgeVariant(page, variant, fetched)).toBeNull();
        }
    });

    it('finds nothing in a redirect, a refusal or an error', () => {
        for (const hops of [
            [
                { url: variant.url, status: 301 },
                { url: page, status: 200 },
            ],
            [{ url: variant.url, status: 405 }],
            [{ url: variant.url, status: 404 }],
        ]) {
            expect(judgeVariant(page, variant, answer(hops))).toBeNull();
        }
    });
});

describe('judgeHttpTwin', () => {
    const page = 'https://acme.com/a';
    const twin = 'http://acme.com/a';

    it('reports an http twin that ends on 200 over http, a canonical to https notwithstanding, on the page', () => {
        const hops = [
            { url: twin, status: 301 },
            { url: 'http://www.acme.com/a', status: 200 },
        ];

        expect(judgeHttpTwin(page, answer(hops))).toEqual({
            check: 'https-missing',
            url: page,
            subject: twin,
            detail: {
                reason: 'no-redirect',
                status: 200,
                finalUrl: 'http://www.acme.com/a',
                hops,
            },
        });

        expect(
            judgeHttpTwin(
                page,
                answer([{ url: twin, status: 200 }], {
                    body: `<head><link rel="canonical" href="${page}"></head>`,
                    headers: { link: `<${page}>; rel="canonical"` },
                }),
            ),
        ).toMatchObject({ check: 'https-missing', subject: twin });
    });

    it('finds nothing in a twin that redirects to https, or answers 4xx or 5xx', () => {
        for (const hops of [
            [
                { url: twin, status: 301 },
                { url: page, status: 200 },
            ],
            [{ url: twin, status: 404 }],
            [{ url: twin, status: 503 }],
            [
                { url: twin, status: 301 },
                { url: 'https://acme.com/gone', status: 404 },
            ],
        ]) {
            expect(judgeHttpTwin(page, answer(hops))).toBeNull();
        }
    });
});

describe('stagingHosts', () => {
    const linked = {
        'staging.acme.com': 'https://staging.acme.com/pricing',
        'DEV.shop.acme.com': 'https://dev.shop.acme.com/',
        'devtools.acme.com': 'https://devtools.acme.com/',
        'blog.acme.com': 'https://blog.acme.com/',
        'staging.other.com': 'https://staging.other.com/',
        'testacme.com': 'https://testacme.com/',
    };

    it('keeps the hosts under the domain with a whole staging label, the www of the domain dropped', () => {
        expect(stagingHosts(linked, 'www.acme.com')).toEqual([
            ['staging.acme.com', 'https://staging.acme.com/pricing'],
            ['DEV.shop.acme.com', 'https://dev.shop.acme.com/'],
        ]);
    });

    it('reads only the labels before the domain, so a domain named test is not a staging host', () => {
        expect(
            stagingHosts(
                { 'blog.test.io': 'https://blog.test.io/' },
                'test.io',
            ),
        ).toEqual([]);
    });
});

describe('judgeStaging', () => {
    const url = 'https://staging.acme.com/pricing';

    it('reports a staging page that answers 200 with no noindex', () => {
        expect(
            judgeStaging(
                'staging.acme.com',
                url,
                answer([{ url, status: 200 }], { body: '<h1>Pricing</h1>' }),
            ),
        ).toEqual({
            check: 'staging-indexable',
            url: null,
            subject: 'staging.acme.com',
            detail: { url, status: 200 },
        });
    });

    it('finds nothing when a robots meta tag or X-Robots-Tag says noindex, or the page redirects or fails', () => {
        for (const fetched of [
            answer([{ url, status: 200 }], {
                body: '<head><meta name="robots" content="noindex"></head>',
            }),
            answer([{ url, status: 200 }], {
                headers: { 'x-robots-tag': 'noindex' },
            }),
            answer([
                { url, status: 302 },
                { url: 'https://staging.acme.com/login', status: 200 },
            ]),
            answer([{ url, status: 401 }]),
        ]) {
            expect(judgeStaging('staging.acme.com', url, fetched)).toBeNull();
        }
    });
});

describe('contentPaths', () => {
    const googlebotGroup = disallowing(
        'User-agent: Googlebot\nDisallow: /shop/\nDisallow: /blog/\nDisallow: /listed',
    );

    const queue = [
        ...Array.from({ length: 7 }, (_, index) =>
            entry(`https://acme.com/a${index}`, 'read'),
        ),
        entry('https://acme.com/shop/1', 'read'),
        entry('https://acme.com/shop/2', 'blocked'),
        entry('https://acme.com/blog/1', 'blocked'),
        entry('https://acme.com/listed', 'blocked', null),
    ];

    it('reports the share of the linked URLs the Googlebot group disallows when it passes 10%, with the most blocked prefixes', () => {
        expect(contentPaths(queue, googlebotGroup)).toEqual({
            check: 'robots-googlebot-blocked',
            url: null,
            subject: 'content-paths',
            detail: {
                reason: 'content-paths',
                blocked: 3,
                linked: 10,
                prefixes: ['/shop', '/blog'],
            },
        });
    });

    it('counts no URL that a CitequillBot group alone disallows', () => {
        expect(
            contentPaths(
                queue,
                disallowing(
                    'User-agent: CitequillBot\nDisallow: /shop/\nDisallow: /blog/',
                ),
            ),
        ).toBeNull();
    });

    it('finds nothing at 10% or less, or with no linked URL', () => {
        const tenth = [
            ...Array.from({ length: 9 }, (_, index) =>
                entry(`https://acme.com/a${index}`, 'read'),
            ),
            entry('https://acme.com/shop/1', 'blocked'),
        ];

        expect(
            contentPaths(tenth, disallowing('User-agent: *\nDisallow: /shop/')),
        ).toBeNull();

        expect(contentPaths([], blocksAll)).toBeNull();

        expect(
            contentPaths(
                [entry('https://acme.com/x', 'blocked', null)],
                blocksAll,
            ),
        ).toBeNull();
    });

    it(`names ${contentPathPrefixes} prefixes at most, the most frequent first and ties by name`, () => {
        const blocked = Array.from({ length: 12 }, (_, index) =>
            entry(
                `https://acme.com/p${String(index).padStart(2, '0')}/x`,
                'blocked',
            ),
        );

        const finding = contentPaths(
            [
                ...blocked,
                entry('https://acme.com/p11/y', 'blocked'),
                entry('https://acme.com/', 'blocked'),
            ],
            blocksAll,
        );

        expect((finding?.detail as { prefixes: string[] }).prefixes).toEqual([
            '/p11',
            '/',
            '/p00',
            '/p01',
            '/p02',
            '/p03',
            '/p04',
            '/p05',
            '/p06',
            '/p07',
        ]);
    });
});

describe('linkedHosts', () => {
    it('adds the first link of each foreign host and keeps what was there', () => {
        expect(
            linkedHosts(
                { 'old.com': 'https://old.com/first' },
                [
                    'https://acme.com/a',
                    'https://www.acme.com/b',
                    'https://old.com/second',
                    'https://staging.acme.com/pricing',
                    'https://staging.acme.com/other',
                ],
                hosts,
            ),
        ).toEqual({
            'old.com': 'https://old.com/first',
            'staging.acme.com': 'https://staging.acme.com/pricing',
        });
    });

    it(`stops at ${linkedHostCap} hosts`, () => {
        const links = Array.from(
            { length: linkedHostCap + 5 },
            (_, index) => `https://host${index}.com/`,
        );

        const linked = linkedHosts({}, links, hosts);

        expect(Object.keys(linked)).toHaveLength(linkedHostCap);
        expect(linked).not.toHaveProperty(`host${linkedHostCap}.com`);
    });
});

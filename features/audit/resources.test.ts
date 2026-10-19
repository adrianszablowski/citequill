import { describe, expect, it, vi } from 'vitest';

import { readAuditPage } from '@/features/audit/page';
import { linkedFromCap, siteHosts } from '@/features/audit/queue';
import {
    addResources,
    answerOf,
    askResource,
    externalLinks,
    type Frontier,
    imgHeavyBytes,
    isForeignResource,
    isSampledAsset,
    judgeResource,
    pageResources,
    refusedAnswer,
    refusedHosts,
    type ReadUrl,
    type Resource,
    resourceCaps,
} from '@/features/audit/resources';
import type { Fetched } from '@/features/crawl/fetch';

const page = 'https://acme.com/a';

const hosts = siteHosts('acme.com', ['https://acme.com']);

const jsonLdHtml = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","image":"/hero.png","publisher":{"@type":"Organization","logo":"https://img.other.com/logo.png"}}</script>`;

const sample = new Set([page]);

const isForeign = (resource: Pick<Resource, 'url' | 'kind'>) =>
    isForeignResource(resource, hosts, 'acme.com');

function anchors(...hrefs: string[]) {
    return hrefs.map((href) => ({
        href,
        url: new URL(href, page).href.replace(/#.*$/, ''),
    })) as never;
}

function fetched(
    status: number,
    headers: Record<string, string> = {},
): Fetched {
    return {
        ok: status < 400,
        status,
        url: 'https://acme.com/final.png',
        headers: new Headers(headers),
        body: '',
        isTruncated: false,
        hops: [{ url: 'https://acme.com/final.png', status }],
        headersMs: 0,
    };
}

function row(kind: Resource['kind'], linkedFrom = [page]): Resource {
    return {
        url: 'https://acme.com/r.png',
        kind,
        linked_from: linkedFrom,
        link_count: 7,
        state: 'queued',
        status_code: null,
        content_length: null,
        error: null,
    };
}

function answer(
    status: number | null,
    contentLength: number | null = null,
    isUncached = false,
) {
    return {
        status,
        contentLength,
        error: status === null ? 'timed out' : null,
        finalUrl: status === null ? null : 'https://acme.com/final.png',
        isUncached,
    };
}

function frontierOf(count: number, kind: Resource['kind']): Frontier {
    return new Map(
        Array.from({ length: count }, (_, i) => {
            const url = `https://acme.com/${kind}/${i}`;

            return [url, { ...row(kind), url }];
        }),
    );
}

describe('pageResources', () => {
    it('lists the JSON-LD images, the og:images, the internal images, the assets and the external links of a page once each, the first role winning', () => {
        const { structuredData } = readAuditPage(jsonLdHtml, page);

        expect(
            pageResources(
                page,
                {
                    structuredData,
                    ogImages: [
                        'https://acme.com/hero.png',
                        'https://acme.com/og.png',
                    ],
                    images: [
                        { tag: 'img', src: 'https://acme.com/hero.png' },
                        { tag: 'img', src: 'https://other.com/b.png' },
                        { tag: 'svg', src: null },
                        { tag: 'img', src: 'https://cdn.acme.com/c.png' },
                    ] as never,
                    assets: ['https://cdn.other.com/app.js'],
                    anchors: anchors(
                        'https://acme.com/b',
                        'https://other.com/x',
                        'https://blog.acme.com/y',
                    ),
                },
                hosts,
                'acme.com',
                true,
            ).map(({ url, kind, from }) => [kind, url, from]),
        ).toEqual([
            ['jsonld_image', 'https://acme.com/hero.png', page],
            ['jsonld_image', 'https://img.other.com/logo.png', page],
            ['og_image', 'https://acme.com/og.png', page],
            ['image', 'https://cdn.acme.com/c.png', page],
            ['asset', 'https://cdn.other.com/app.js', page],
            ['external', 'https://other.com/x', page],
            ['external', 'https://blog.acme.com/y', page],
        ]);
    });

    it('lists no JSON-LD image of a page that is not indexable, the structured data checks’ scope', () => {
        const { structuredData } = readAuditPage(jsonLdHtml, page);

        expect(
            pageResources(
                page,
                {
                    structuredData,
                    ogImages: ['https://acme.com/hero.png'],
                    images: [],
                    assets: [],
                    anchors: [],
                },
                hosts,
                'acme.com',
                false,
            ).map(({ url, kind }) => [kind, url]),
        ).toEqual([['og_image', 'https://acme.com/hero.png']]);
    });
});

describe('externalLinks', () => {
    it("lists each link off the site's own hosts once, one under the domain included, and leaves out what link-malformed flags", () => {
        expect(
            externalLinks(
                page,
                {
                    anchors: anchors(
                        '/b',
                        'https://www.acme.com/c',
                        'https://other.com/x',
                        'https://other.com/x#top',
                        'https://blog.acme.com/y',
                        'http://localhost:3000/z',
                        'http://[::1]/z',
                        'http://0.0.0.0/z',
                        '\\\\server\\share',
                    ),
                },
                hosts,
            ),
        ).toEqual(['https://other.com/x', 'https://blog.acme.com/y']);
    });
});

describe('isForeignResource', () => {
    it('calls every external link foreign, and another resource foreign only off the site and its domain', () => {
        expect(
            isForeignResource(
                { url: 'https://blog.acme.com/x', kind: 'external' },
                hosts,
                'acme.com',
            ),
        ).toBe(true);

        expect(
            isForeignResource(
                { url: 'https://cdn.acme.com/a.png', kind: 'image' },
                hosts,
                'acme.com',
            ),
        ).toBe(false);

        expect(
            isForeignResource(
                { url: 'https://cdn.other.com/app.js', kind: 'asset' },
                hosts,
                'acme.com',
            ),
        ).toBe(true);
    });
});

describe('addResources', () => {
    it('adds a new resource with its first linking page and counts every page linking to a known one', () => {
        const first = addResources(new Map(), [
            { url: 'https://other.com/x', kind: 'external', from: page },
        ]);

        const pages = Array.from(
            { length: linkedFromCap + 1 },
            (_, i) => `https://acme.com/p${i}`,
        );

        const { frontier, touched } = addResources(
            first.frontier,
            pages.map((from) => ({
                url: 'https://other.com/x',
                kind: 'image' as const,
                from,
            })),
        );

        expect(frontier.get('https://other.com/x')).toMatchObject({
            kind: 'external',
            state: 'queued',
            link_count: linkedFromCap + 2,
            linked_from: [page, ...pages.slice(0, linkedFromCap - 1)],
        });

        expect(touched).toEqual(['https://other.com/x']);
    });

    it(`stores ${resourceCaps.external} external links and ${resourceCaps.internal} other resources at most, the first seen first`, () => {
        const full = new Map([
            ...frontierOf(resourceCaps.external, 'external'),
            ...frontierOf(resourceCaps.internal - 1, 'image'),
        ]);

        const { frontier, touched } = addResources(full, [
            { url: 'https://other.com/new', kind: 'external', from: page },
            { url: 'https://acme.com/last.png', kind: 'og_image', from: page },
            { url: 'https://acme.com/over.js', kind: 'asset', from: page },
            {
                url: 'https://acme.com/external/0',
                kind: 'external',
                from: page,
            },
        ]);

        expect(frontier.has('https://other.com/new')).toBe(false);
        expect(frontier.has('https://acme.com/last.png')).toBe(true);
        expect(frontier.has('https://acme.com/over.js')).toBe(false);

        expect(touched).toEqual([
            'https://acme.com/last.png',
            'https://acme.com/external/0',
        ]);
    });

    it('adds nothing from a page with no resources', () => {
        expect(addResources(new Map(), []).touched).toEqual([]);
    });
});

describe('askResource', () => {
    it('sends HEAD, and GET only when HEAD answers 405 or 501', async () => {
        for (const [status, methods] of [
            [200, ['HEAD']],
            [404, ['HEAD']],
            [405, ['HEAD', 'GET']],
            [501, ['HEAD', 'GET']],
        ] as const) {
            const read = vi.fn<ReadUrl>(async () => fetched(status));

            await askResource(read, 'https://acme.com/r.png');

            expect(
                read.mock.calls.map(([, options]) => options?.method),
            ).toEqual(methods);
        }
    });

    it('returns an error or a missed turn as it came, without a GET', async () => {
        for (const outcome of [new Error('timed out'), null]) {
            const read = vi.fn<ReadUrl>(async () => outcome);

            expect(await askResource(read, 'https://acme.com/r.png')).toBe(
                outcome,
            );

            expect(read).toHaveBeenCalledTimes(1);
        }
    });
});

describe('answerOf', () => {
    it('keeps the final status, the final URL and the declared length', () => {
        expect(answerOf(fetched(200, { 'content-length': '2048' }))).toEqual({
            status: 200,
            contentLength: 2048,
            error: null,
            finalUrl: 'https://acme.com/final.png',
            isUncached: true,
        });

        expect(answerOf(fetched(200)).contentLength).toBeNull();

        expect(
            answerOf(fetched(200, { 'content-length': '9999999999' }))
                .contentLength,
        ).toBeNull();
    });

    it('keeps the message of a fetch that got no answer', () => {
        expect(answerOf(new Error('timed out'))).toEqual({
            status: null,
            contentLength: null,
            error: 'timed out',
            finalUrl: null,
            isUncached: false,
        });
    });

    it('calls an answer uncached when it has neither Cache-Control nor Expires', () => {
        expect(answerOf(fetched(200)).isUncached).toBe(true);

        expect(
            answerOf(fetched(200, { 'cache-control': 'max-age=31536000' }))
                .isUncached,
        ).toBe(false);

        expect(
            answerOf(fetched(200, { expires: 'Thu, 01 Dec 2027 16:00:00 GMT' }))
                .isUncached,
        ).toBe(false);
    });
});

describe('refusedAnswer', () => {
    it('never calls a refusal uncached, because no answer was read', () => {
        expect(refusedAnswer(403).isUncached).toBe(false);
    });
});

describe('refusedHosts', () => {
    it("remembers the hosts that answered 403 or 429 to a foreign request, never the site's own or its domain's images", () => {
        expect(
            refusedHosts(
                [
                    {
                        url: 'https://other.com/a',
                        kind: 'external',
                        status_code: 403,
                    },
                    {
                        url: 'https://shy.net/b',
                        kind: 'asset',
                        status_code: 429,
                    },
                    {
                        url: 'https://blog.acme.com/c',
                        kind: 'external',
                        status_code: 403,
                    },
                    {
                        url: 'https://acme.com/d',
                        kind: 'external',
                        status_code: 403,
                    },
                    {
                        url: 'https://cdn.acme.com/e.png',
                        kind: 'image',
                        status_code: 403,
                    },
                    {
                        url: 'https://fine.org/f',
                        kind: 'external',
                        status_code: 404,
                    },
                ],
                isForeign,
            ),
        ).toEqual(
            new Map([
                ['other.com', 403],
                ['shy.net', 429],
                ['blog.acme.com', 403],
                ['acme.com', 403],
            ]),
        );
    });
});

describe('isSampledAsset', () => {
    it('checks an asset linked from a page of the sample, and every other kind', () => {
        expect(isSampledAsset(row('asset'), sample)).toBe(true);

        expect(
            isSampledAsset(row('asset', ['https://acme.com/b']), sample),
        ).toBe(false);

        expect(
            isSampledAsset(row('image', ['https://acme.com/b']), sample),
        ).toBe(true);
    });
});

describe('judgeResource', () => {
    const checks = (resource: Resource, given: ReturnType<typeof answer>) =>
        judgeResource(
            resource,
            given,
            resource.kind === 'external',
            sample,
        ).map(({ check }) => check);

    it('calls a 403 or 429 to an external link a refusal, never a broken link', () => {
        expect(checks(row('external'), answer(403))).toEqual([
            'link-external-refused',
        ]);

        expect(
            judgeResource(row('external'), answer(429), true, sample)[0].detail,
        ).toMatchObject({ reason: 'refused', status: 429, linkCount: 7 });
    });

    it("calls a 403 or 429 from a foreign host a refusal whatever the resource's kind, and one from the site's own host a fault", () => {
        for (const kind of [
            'image',
            'og_image',
            'jsonld_image',
            'asset',
        ] as const) {
            expect(
                judgeResource(row(kind), answer(403), true, sample).map(
                    ({ check }) => check,
                ),
            ).toEqual(['link-external-refused']);
        }

        expect(checks(row('asset'), answer(403))).toEqual(['resource-broken']);
        expect(checks(row('og_image'), answer(429))).toEqual(['og-image-bad']);
    });

    it('calls an external link broken on another 4xx, a 5xx or no answer after the retry', () => {
        for (const status of [404, 410, 500, null]) {
            expect(checks(row('external'), answer(status))).toEqual([
                'link-broken-external',
            ]);
        }

        expect(checks(row('external'), answer(200))).toEqual([]);
        expect(checks(row('external'), answer(301))).toEqual([]);
    });

    it('calls an image or an asset that is not 200 broken', () => {
        for (const kind of ['image', 'asset'] as const) {
            expect(checks(row(kind), answer(404))).toEqual(['resource-broken']);

            expect(checks(row(kind), answer(null))).toEqual([
                'resource-broken',
            ]);

            expect(checks(row(kind), answer(200))).toEqual([]);
        }
    });

    it(`calls an image heavy over ${imgHeavyBytes} bytes, never an asset or an og:image`, () => {
        expect(checks(row('image'), answer(200, imgHeavyBytes + 1))).toEqual([
            'img-heavy',
        ]);

        expect(checks(row('image'), answer(200, imgHeavyBytes))).toEqual([]);

        expect(checks(row('asset'), answer(200, imgHeavyBytes * 9))).toEqual(
            [],
        );

        expect(checks(row('og_image'), answer(200, imgHeavyBytes * 9))).toEqual(
            [],
        );
    });

    it('calls a script or stylesheet that answers 200 without cache headers uncached, on its sample pages, never an image or a broken asset', () => {
        const pages = ['https://acme.com/a', 'https://acme.com/b'];

        expect(
            judgeResource(
                row('asset', pages),
                answer(200, null, true),
                false,
                sample,
            ),
        ).toEqual([
            {
                check: 'assets-uncached',
                url: page,
                subject: 'https://acme.com/r.png',
                detail: {
                    status: 200,
                    finalUrl: 'https://acme.com/final.png',
                    linkCount: 7,
                },
            },
        ]);

        expect(checks(row('asset'), answer(200, null, false))).toEqual([]);
        expect(checks(row('image'), answer(200, null, true))).toEqual([]);

        expect(checks(row('asset'), answer(404, null, true))).toEqual([
            'resource-broken',
        ]);
    });

    it('calls an og:image that is not 200 og-image-bad alone, by its image half', () => {
        expect(
            judgeResource(row('og_image'), answer(404), false, sample),
        ).toEqual([
            {
                check: 'og-image-bad',
                url: page,
                subject: 'https://acme.com/r.png',
                detail: {
                    reason: 'image',
                    status: 404,
                    finalUrl: 'https://acme.com/final.png',
                    linkCount: 7,
                },
            },
        ]);
    });

    it('calls a JSON-LD image that is not 200 unreachable, on every page linking to it, a foreign one included, and never heavy', () => {
        const pages = ['https://acme.com/a', 'https://acme.com/b'];

        for (const status of [404, 500, 301, null]) {
            expect(
                judgeResource(
                    row('jsonld_image', pages),
                    answer(status),
                    true,
                    sample,
                ).map(({ check, url, subject }) => [check, url, subject]),
            ).toEqual(
                pages.map((url) => [
                    'jsonld-image-unreachable',
                    url,
                    'https://acme.com/r.png',
                ]),
            );
        }

        expect(
            checks(row('jsonld_image'), answer(200, imgHeavyBytes * 9)),
        ).toEqual([]);
    });

    it('puts one finding on each page recorded as linking to the resource', () => {
        const pages = ['https://acme.com/a', 'https://acme.com/b'];

        expect(
            judgeResource(row('image', pages), answer(404), false, sample).map(
                ({ url, subject }) => [url, subject],
            ),
        ).toEqual(pages.map((url) => [url, 'https://acme.com/r.png']));
    });

    it('puts the finding of a script or stylesheet only on its linking pages in the sample', () => {
        const pages = ['https://acme.com/a', 'https://acme.com/b'];

        expect(
            judgeResource(row('asset', pages), answer(404), false, sample).map(
                ({ check, url }) => [check, url],
            ),
        ).toEqual([['resource-broken', page]]);

        expect(
            judgeResource(row('asset', pages), answer(403), true, sample).map(
                ({ check, url }) => [check, url],
            ),
        ).toEqual([['link-external-refused', page]]);
    });
});

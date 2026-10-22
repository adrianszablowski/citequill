import { describe, expect, it } from 'vitest';

import {
    bingbotDirectives,
    canonicalOf,
    googlebotDirectives,
    headerAlternates,
    headerCanonical,
    isIndexable,
    linkHeaderEntries,
    observePage,
    observeRead,
    type Read,
    snippetLimit,
    type ReadContext,
} from '@/features/audit/observe';
import { thinPageWords } from '@/features/audit/page';
import { type QueueEntry, siteHosts } from '@/features/audit/queue';
import type { Fetched, Hop } from '@/features/crawl/fetch';

const context: ReadContext = {
    projectId: 'project',
    auditId: 'audit',
    locales: [{ locale: 'en', base_url: 'https://acme.com', is_default: true }],
    hosts: siteHosts('acme.com', ['https://acme.com']),
    domain: 'acme.com',
    pageIds: new Map([['https://acme.com/blog/post', 'page-1']]),
};

function entry(url: string, depth: number | null = 1): QueueEntry {
    return {
        url,
        depth,
        state: 'queued',
        in_sitemap: true,
        inbound_links: 0,
        linked_from: [],
        alternates: null,
    };
}

function page(
    url: string,
    links: string[],
    hops: Hop[] = [{ url, status: 200 }],
) {
    const body = links.map((href) => `<a href="${href}">link</a>`).join('');

    return {
        ok: true,
        status: hops.at(-1)!.status,
        url: hops.at(-1)!.url,
        headers: new Headers({ 'content-type': 'text/html' }),
        body: `<html><body>${body}</body></html>`,
        bytes: 0,
        isUtf8: true,
        isTruncated: false,
        hops,
        headersMs: 0,
    } satisfies Fetched;
}

function observe(read: Read) {
    return observeRead(read, context);
}

describe('observeRead', () => {
    it('takes the links on the site one click deeper, and never a link of a page to itself', () => {
        const url = 'https://acme.com/a';

        const { row, candidates } = observe({
            entry: entry(url),
            outcome: page(url, [
                '/a',
                '/a#top',
                '/b',
                'https://www.acme.com/c',
                'https://other.com/d',
            ]),
        });

        expect(row).toMatchObject({
            url,
            locale: 'en',
            status_code: 200,
            is_blocked: false,
        });

        expect(candidates).toEqual([
            { url: 'https://acme.com/b', depth: 2, inbound: 1, from: url },
            { url: 'https://www.acme.com/c', depth: 2, inbound: 1, from: url },
        ]);
    });

    it("stores the page's own lang in canonical form when no locale's base URL holds the page", () => {
        const url = 'https://blog.acme.com/a';

        const { row } = observe({
            entry: entry(url),
            outcome: {
                ...page(url, []),
                body: '<html lang="en-gb"><body></body></html>',
            },
        });

        expect(row.locale).toBe('en-GB');
    });

    it("counts the page's distinct external links and lists what the resources step checks, with the page as the one linking", () => {
        const url = 'https://acme.com/a';

        const { row, resources } = observe({
            entry: entry(url),
            outcome: {
                ...page(url, []),
                body: '<html><head><meta property="og:image" content="/og.png"><link rel="stylesheet" href="https://fonts.example.net/a.css"><script src="/app.js"></script></head><body><img src="/hero.png" alt="Hero"><img src="https://cdn.acme.com/b.png" alt="B"><img src="https://other.com/c.png" alt="C"><a href="https://other.com/x">x</a><a href="https://other.com/x#top">x</a><a href="https://blog.acme.com/y">y</a><a href="/b">b</a></body></html>',
            },
        });

        expect(row.external_link_count).toBe(2);

        expect(resources).toEqual(
            [
                ['og_image', 'https://acme.com/og.png'],
                ['image', 'https://acme.com/hero.png'],
                ['image', 'https://cdn.acme.com/b.png'],
                ['asset', 'https://fonts.example.net/a.css'],
                ['asset', 'https://acme.com/app.js'],
                ['external', 'https://other.com/x'],
                ['external', 'https://blog.acme.com/y'],
            ].map(([kind, resource]) => ({ url: resource, kind, from: url })),
        );
    });

    it('queues the page a redirect lands on at the depth of the URL that redirected, and none of its links', () => {
        const url = 'https://acme.com/old';

        const { row, candidates } = observe({
            entry: entry(url, 2),
            outcome: page(
                url,
                ['/elsewhere'],
                [
                    { url, status: 301 },
                    { url: 'https://www.acme.com/new', status: 200 },
                ],
            ),
        });

        expect(row).toMatchObject({
            status_code: 301,
            redirect_to: 'https://www.acme.com/new',
        });

        expect(candidates).toEqual([
            { url: 'https://www.acme.com/new', depth: 2 },
        ]);

        const offSite = observe({
            entry: entry(url),
            outcome: page(
                url,
                [],
                [
                    { url, status: 301 },
                    { url: 'https://other.com/', status: 200 },
                ],
            ),
        });

        expect(offSite.candidates).toEqual([]);
    });

    it('matches a page Citequill published by its path, with or without the trailing slash', () => {
        const pageId = (url: string) =>
            observe({ entry: entry(url), outcome: page(url, []) }).row.page_id;

        expect(pageId('https://acme.com/blog/post')).toBe('page-1');
        expect(pageId('https://acme.com/blog/post/')).toBe('page-1');
        expect(pageId('https://acme.com/blog/other')).toBeNull();
    });

    it('records the first description and the images the checks list, decorative and header ones included', () => {
        const url = 'https://acme.com/a';

        const { row } = observe({
            entry: entry(url),
            outcome: {
                ...page(url, []),
                body: '<html><head><meta name="description" content=" Plans. "><meta name="description" content="Other"></head><body><header><img src="/logo.png" alt="Acme"></header><img src="/line.png" alt=""><img src="/pixel.gif" alt="" width="1" height="1"><svg aria-hidden="true"></svg></body></html>',
            },
        });

        expect(row).toMatchObject({ description: 'Plans.', image_count: 2 });
    });

    it(`records the SimHash of a main text of ${thinPageWords} words or more, which near-duplicate compares, and none of a shorter one`, () => {
        const url = 'https://acme.com/a';

        const simhashOf = (count: number) =>
            observe({
                entry: entry(url),
                outcome: {
                    ...page(url, []),
                    body: `<html><body><main>${Array.from({ length: count }, (_, i) => `word${i}`).join(' ')}</main></body></html>`,
                },
            }).row.body_simhash;

        expect(simhashOf(thinPageWords)).toMatch(/^[0-9a-f]{16}$/);
        expect(simhashOf(thinPageWords - 1)).toBeNull();
    });

    it('records a blocked or failed read as a URL that did not answer, with what the queue knew', () => {
        const url = 'https://acme.com/private';

        for (const [outcome, isBlocked] of [
            ['blocked', true],
            [new Error('timeout'), false],
        ] as const) {
            const { row, candidates } = observe({ entry: entry(url), outcome });

            expect(row).toMatchObject({
                status_code: null,
                final_url: null,
                is_indexable: false,
                is_blocked: isBlocked,
                title: null,
                body_hash: null,
                body_simhash: null,
                description: null,
                image_count: 0,
                click_depth: 1,
                in_sitemap: true,
            });

            expect(candidates).toEqual([]);
        }
    });
});

describe('observeRead, for hreflang', () => {
    const url = 'https://acme.com/a';

    const alternates = [
        { lang: 'de', href: 'https://acme.de/a' },
        { lang: 'x-default', href: 'https://acme.com/a' },
        { lang: 'fr', href: 'https://acme.com/fr/a' },
        { lang: 'es', href: 'https://other.com/es/a' },
    ];

    function hreflangRead(sitemap: typeof alternates | null = alternates) {
        return observe({
            entry: {
                ...entry(url),
                alternates: sitemap,
            },
            outcome: {
                ...page(url, []),
                headers: new Headers({
                    'content-type': 'text/html',
                    link: '<https://acme.de/a>; rel="alternate"; hreflang="de", <https://acme.com/it/a>; rel="alternate"; hreflang="it"',
                }),
                body: '<html><head><link rel="alternate" hreflang="EN" href="/a"><link rel="alternate" hreflang="de" href="https://acme.de/a"></head><body></body></html>',
            },
        });
    }

    it('records the union of the tags and the Link header, each language and URL once, and leaves the sitemap set on the queue', () => {
        expect(hreflangRead().row.hreflang).toEqual([
            { lang: 'en', href: url },
            { lang: 'de', href: 'https://acme.de/a' },
            { lang: 'it', href: 'https://acme.com/it/a' },
        ]);
    });

    it('counts the distinct alternate URLs of the tags, the header and the sitemap entry together, x-default included', () => {
        expect(hreflangRead().row.hreflang_count).toBe(5);
        expect(hreflangRead(null).row.hreflang_count).toBe(3);
    });

    it("queues every alternate on the site's hosts, of every method, without a click depth and without counting it as a link, and none on another host", () => {
        expect(hreflangRead().candidates).toEqual([
            { url: 'https://acme.com/it/a', depth: null },
            { url: 'https://acme.com/fr/a', depth: null },
        ]);
    });

    it('counts an href that does not resolve by its text, and a tag without href as no alternate', () => {
        const count = (head: string) =>
            observe({
                entry: entry(url),
                outcome: {
                    ...page(url, []),
                    body: `<html><head>${head}</head><body></body></html>`,
                },
            }).row.hreflang_count;

        expect(
            count(
                '<link rel="alternate" hreflang="fr" href="javascript:void(0)">',
            ),
        ).toBe(1);

        expect(count('<link rel="alternate" hreflang="fr">')).toBe(0);
    });

    it('reads the Link header alternates of an answer that is not HTML', () => {
        const pdf = 'https://acme.com/file.pdf';

        const { row, candidates } = observe({
            entry: entry(pdf),
            outcome: {
                ...page(pdf, []),
                headers: new Headers({
                    'content-type': 'application/pdf',
                    link: '<https://acme.com/de/file.pdf>; rel="alternate"; hreflang="de"',
                }),
                body: '%PDF-1.7',
            },
        });

        expect(row).toMatchObject({
            hreflang: [{ lang: 'de', href: 'https://acme.com/de/file.pdf' }],
            hreflang_count: 1,
        });

        expect(candidates).toEqual([
            { url: 'https://acme.com/de/file.pdf', depth: null },
        ]);
    });

    it('records no alternates and no count for a page it could not read', () => {
        const { row, alternates: sets } = observe({
            entry: { ...entry(url), alternates },
            outcome: new Error('timeout'),
        });

        expect(row).toMatchObject({ hreflang: null, hreflang_count: 0 });
        expect(sets).toBeNull();
    });
});

describe('observeRead, for structured data', () => {
    const url = 'https://acme.com/shop';

    const read = (body: string) =>
        observe({
            entry: entry(url),
            outcome: { ...page(url, []), body },
        }).row;

    it('counts every JSON-LD block that is not blank, one that does not parse included, so a page whose only block is broken is in the scope of the structured data checks', () => {
        expect(
            read(
                '<script type="application/ld+json">{"@type": "Product",}</script>',
            ),
        ).toMatchObject({ jsonld_count: 1, has_microdata: false });

        expect(
            read(
                '<script type="application/ld+json">{}</script><script type="application/ld+json">[</script>',
            ).jsonld_count,
        ).toBe(2);

        expect(
            read(
                '<script type="application/ld+json"> \n </script><script type="application/ld+json"></script>',
            ).jsonld_count,
        ).toBe(0);
    });

    it('queues the JSON-LD images of an indexable page only', () => {
        const images = (head: string) =>
            observe({
                entry: entry(url),
                outcome: {
                    ...page(url, []),
                    body: `<html><head>${head}</head><body><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","image":"/hero.png"}</script></body></html>`,
                },
            }).resources.map(({ kind, url }) => [kind, url]);

        expect(images('')).toEqual([
            ['jsonld_image', 'https://acme.com/hero.png'],
        ]);

        expect(images('<meta name="robots" content="noindex">')).toEqual([]);
    });

    it('records microdata or RDFa, and nothing for a page it could not read', () => {
        expect(
            read('<div itemscope itemtype="https://schema.org/Product"></div>'),
        ).toMatchObject({ jsonld_count: 0, has_microdata: true });

        expect(
            observe({ entry: entry(url), outcome: new Error('timeout') }).row,
        ).toMatchObject({ jsonld_count: 0, has_microdata: false });
    });

    it('records whether the page is an article, a page with noindex included, and no article for a page it could not read', () => {
        expect(
            read(
                '<script type="application/ld+json">{"@context": "https://schema.org", "@type": "NewsArticle"}</script>',
            ),
        ).toMatchObject({ is_article: true });

        expect(
            read(
                '<meta name="robots" content="noindex"><meta property="og:type" content="article">',
            ),
        ).toMatchObject({ is_article: true, is_indexable: false });

        expect(
            read(
                '<script type="application/ld+json">{"@context": "https://schema.org", "@type": "Blog", "blogPost": {"@type": "BlogPosting"}}</script>',
            ),
        ).toMatchObject({ is_article: false });

        expect(
            observe({ entry: entry(url), outcome: new Error('timeout') }).row,
        ).toMatchObject({ is_article: false });
    });
});

describe('observeRead, for the shell test', () => {
    const url = 'https://acme.com/';
    const shell = '<html><body><div id="root"></div></body></html>';

    const isShell = (outcome: Read['outcome']) =>
        observe({ entry: entry(url), outcome }).row.is_shell;

    it('records a shell for a page that answered 200 with HTML that is one', () => {
        expect(isShell({ ...page(url, []), body: shell })).toBe(true);

        expect(
            isShell({
                ...page(url, []),
                body: `<html><body><p>${'a'.repeat(200)}</p></body></html>`,
            }),
        ).toBe(false);
    });

    it('records no shell for an answer other than a 200 of HTML, a redirect, or no answer', () => {
        expect(
            isShell({
                ...page(url, [], [{ url, status: 203 }]),
                body: shell,
            }),
        ).toBe(false);

        expect(
            isShell({
                ...page(url, [], [{ url, status: 404 }]),
                ok: false,
                body: shell,
            }),
        ).toBe(false);

        expect(
            isShell({
                ...page(
                    url,
                    [],
                    [
                        { url, status: 301 },
                        { url: 'https://acme.com/en', status: 200 },
                    ],
                ),
                body: shell,
            }),
        ).toBe(false);

        expect(
            isShell({
                ...page(url, []),
                headers: new Headers({ 'content-type': 'application/json' }),
                body: shell,
            }),
        ).toBe(false);

        expect(isShell(new Error('timeout'))).toBe(false);
        expect(isShell('blocked')).toBe(false);
    });

    it('records no shell for a page cut at the size cap, whose body it may not have read', () => {
        expect(
            isShell({ ...page(url, []), body: shell, isTruncated: true }),
        ).toBe(false);
    });
});

describe('headerAlternates', () => {
    it("reads Google's example header, each code as written, each URL absolute", () => {
        expect(
            headerAlternates(
                '<https://example.com/file.pdf>; rel="alternate"; hreflang="en", <https://de-ch.example.com/file.pdf>; rel="alternate"; hreflang="de-CH", <https://de.example.com/file.pdf>; rel="alternate"; hreflang="de"',
                'https://example.com/file.pdf',
            ),
        ).toEqual([
            {
                lang: 'en',
                href: 'https://example.com/file.pdf',
                url: 'https://example.com/file.pdf',
            },
            {
                lang: 'de-CH',
                href: 'https://de-ch.example.com/file.pdf',
                url: 'https://de-ch.example.com/file.pdf',
            },
            {
                lang: 'de',
                href: 'https://de.example.com/file.pdf',
                url: 'https://de.example.com/file.pdf',
            },
        ]);
    });

    it('keeps a relative URL as written beside its absolute form, and skips links that are not alternates with a language, an alternative stylesheet and an empty URL', () => {
        expect(
            headerAlternates(
                '</de>; rel=alternate; hreflang=de, </feed>; rel="alternate", </b>; rel="canonical"; hreflang="en", </s.css>; rel="alternate stylesheet"; hreflang="fr", <>; rel="alternate"; hreflang="it"',
                'https://acme.com/a',
            ),
        ).toEqual([{ lang: 'de', href: '/de', url: 'https://acme.com/de' }]);

        expect(headerAlternates(null, 'https://acme.com/')).toEqual([]);
    });
});

describe('linkHeaderEntries', () => {
    it('reads the URL, the relations, the language and the type of every link of the header', () => {
        expect(
            linkHeaderEntries(
                '<https://acme.com/a.css>; rel=preload, </pricing>; REL="Canonical Alternate"; hreflang="en-GB", </index.md>; rel="alternate"; Type="text/markdown"',
            ),
        ).toEqual([
            {
                href: 'https://acme.com/a.css',
                rel: ['preload'],
                hreflang: null,
                type: null,
            },
            {
                href: '/pricing',
                rel: ['canonical', 'alternate'],
                hreflang: 'en-GB',
                type: null,
            },
            {
                href: '/index.md',
                rel: ['alternate'],
                hreflang: null,
                type: 'text/markdown',
            },
        ]);

        expect(linkHeaderEntries(null)).toEqual([]);
    });
});

describe('googlebotDirectives', () => {
    it('reads the robots and googlebot meta and the header lines for Googlebot or every crawler', () => {
        expect(
            googlebotDirectives(
                ['NOINDEX, follow'],
                'googlebot: nosnippet, otherbot: noarchive, notranslate',
            ),
        ).toEqual(['noindex', 'follow', 'nosnippet']);

        expect(googlebotDirectives([], 'noindex')).toEqual(['noindex']);
    });

    it('keeps a directive with a value whole instead of reading it as a crawler', () => {
        expect(
            googlebotDirectives(
                [],
                'unavailable_after: 25 Jun 2030 15:00:00 PST, max-snippet: 50',
            ),
        ).toEqual([
            'unavailable_after: 25 jun 2030 15:00:00 pst',
            'max-snippet: 50',
        ]);
    });

    it('reads an unavailable_after date written with a comma whole, in the meta and in the header', () => {
        for (const date of [
            'Friday, 25-Jun-27 15:00:00 GMT',
            'Fri, 25 Jun 2027 15:00:00 GMT',
            '2027-06-25T15:00:00+02:00',
        ]) {
            const directive = `unavailable_after: ${date}`.toLowerCase();

            expect(
                googlebotDirectives(
                    [`noindex, unavailable_after: ${date}`],
                    null,
                ),
                date,
            ).toEqual(['noindex', directive]);

            expect(
                googlebotDirectives(
                    [],
                    `unavailable_after: ${date}, nosnippet`,
                ),
                date,
            ).toEqual([directive, 'nosnippet']);
        }
    });

    it('ends the date at the next directive or crawler, and keeps a date scoped to another crawler out', () => {
        expect(
            googlebotDirectives(
                [],
                'googlebot: unavailable_after: Friday, 25-Jun-27 15:00:00 GMT, noarchive, otherbot: unavailable_after: Fri, 25 Jun 2027 15:00:00 GMT, noindex',
            ),
        ).toEqual([
            'unavailable_after: friday, 25-jun-27 15:00:00 gmt',
            'noarchive',
        ]);

        expect(
            bingbotDirectives(
                [],
                'googlebot: unavailable_after: Friday, 25-Jun-27 15:00:00 GMT, bingbot: max-snippet: 20',
            ),
        ).toEqual(['max-snippet: 20']);

        expect(
            googlebotDirectives(
                ['unavailable_after: Friday, 25-Jun-27 15:00:00 GMT, extra'],
                null,
            ),
        ).toEqual([
            'unavailable_after: friday, 25-jun-27 15:00:00 gmt',
            'extra',
        ]);
    });

    it('never glues a directive it does not know onto a date', () => {
        for (const date of [
            '2027-06-25',
            'Friday, 25-Jun-27 15:00:00 PST',
            'Fri, 25 Jun 2027 15:00:00 PST',
        ]) {
            const directive = `unavailable_after: ${date}`.toLowerCase();

            expect(
                googlebotDirectives([`unavailable_after: ${date}, noai`], null),
                date,
            ).toEqual([directive, 'noai']);

            expect(
                googlebotDirectives(
                    [],
                    `unavailable_after: ${date}, noimageai, otherbot: noindex`,
                ),
                date,
            ).toEqual([directive, 'noimageai']);

            expect(
                bingbotDirectives(
                    [],
                    `unavailable_after: ${date}, bingbot: noindex`,
                ),
                date,
            ).toEqual([directive, 'noindex']);
        }
    });
});

describe('bingbotDirectives', () => {
    it('reads the header lines for Bingbot or every crawler, and never a line scoped to Googlebot', () => {
        expect(
            bingbotDirectives(
                ['noarchive'],
                'googlebot: nocache, bingbot: nosnippet, otherbot: noindex',
            ),
        ).toEqual(['noarchive', 'nosnippet']);

        expect(bingbotDirectives([], 'BINGBOT: noarchive')).toEqual([
            'noarchive',
        ]);
    });

    it('leaves the Googlebot set as it was', () => {
        expect(googlebotDirectives([], 'bingbot: noarchive')).toEqual([]);
    });
});

describe('snippetLimit', () => {
    it('reads a max-snippet number, no limit as -1, null for a value that is not one, and nothing for another directive', () => {
        expect(snippetLimit('max-snippet:-1')).toBe(-1);
        expect(snippetLimit('max-snippet: 0')).toBe(0);
        expect(snippetLimit('max-snippet:159')).toBe(159);
        expect(snippetLimit('max-snippet: lots')).toBeNull();
        expect(snippetLimit('max-snippet:')).toBeNull();
        expect(snippetLimit('max-image-preview:large')).toBeUndefined();
        expect(snippetLimit('nosnippet')).toBeUndefined();
    });
});

describe('isIndexable', () => {
    it('needs a 200 and no noindex or none', () => {
        expect(isIndexable(200, ['follow'])).toBe(true);
        expect(isIndexable(200, ['noindex'])).toBe(false);
        expect(isIndexable(200, ['none'])).toBe(false);
        expect(isIndexable(404, [])).toBe(false);
        expect(isIndexable(301, [])).toBe(false);
    });
});

describe('observePage', () => {
    it('describes a page that answered by itself', () => {
        expect(
            observePage({
                hops: [{ url: 'https://acme.com/a', status: 200 }],
                title: 'A',
                canonical: 'https://acme.com/a',
                directives: [],
            }),
        ).toEqual({
            status_code: 200,
            final_url: 'https://acme.com/a',
            redirect_to: null,
            is_indexable: true,
            canonical_url: 'https://acme.com/a',
            title: 'A',
        });
    });

    it('describes a redirect by its own answer, never by the page it lands on', () => {
        expect(
            observePage({
                hops: [
                    { url: 'https://acme.com/a', status: 301 },
                    { url: 'https://acme.com/a/', status: 302 },
                    { url: 'https://www.acme.com/a/', status: 200 },
                ],
                title: 'A',
                canonical: null,
                directives: [],
            }),
        ).toEqual({
            status_code: 301,
            final_url: 'https://www.acme.com/a/',
            redirect_to: 'https://acme.com/a/',
            is_indexable: false,
            canonical_url: null,
            title: null,
        });
    });

    it('marks a page that did not answer as not indexable', () => {
        expect(observePage(null)).toMatchObject({
            status_code: null,
            is_indexable: false,
        });
    });
});

describe('canonicalOf', () => {
    it('takes the HTML canonical, else the one the Link header names', () => {
        const headers = new Headers({ link: '</b>; rel="canonical"' });

        expect(
            canonicalOf('https://acme.com/a', headers, 'https://acme.com/x'),
        ).toBe('https://acme.com/a');

        expect(canonicalOf(null, headers, 'https://acme.com/x')).toBe(
            'https://acme.com/b',
        );

        expect(
            canonicalOf(null, new Headers(), 'https://acme.com/x'),
        ).toBeNull();
    });
});

describe('headerCanonical', () => {
    it('reads the canonical a Link header names, among other links', () => {
        expect(
            headerCanonical(
                '<https://cdn.acme.com/a.css>; rel=preload, </pricing>; rel="canonical"',
                'https://acme.com/pricing?ref=x',
            ),
        ).toBe('https://acme.com/pricing');

        expect(
            headerCanonical(
                '<https://acme.com/a.css>; rel=preload',
                'https://acme.com/',
            ),
        ).toBeNull();

        expect(headerCanonical(null, 'https://acme.com/')).toBeNull();
    });
});

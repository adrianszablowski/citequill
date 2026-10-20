import { describe, expect, it } from 'vitest';

import { observeRead, type Read } from '@/features/audit/observe';
import { thinPageWords } from '@/features/audit/page';
import { checkPage, type PageCheckContext } from '@/features/audit/page-checks';
import { type QueueEntry, siteHosts } from '@/features/audit/queue';
import { type Fetched, type Hop, maxBytes } from '@/features/crawl/fetch';

const locales = [
    { locale: 'en', base_url: 'https://acme.com', is_default: true },
    { locale: 'de', base_url: 'https://acme.com/de', is_default: false },
];

const hosts = siteHosts('acme.com', ['https://acme.com']);

const context: PageCheckContext = {
    obeyRobots: true,
    isDisallowed: () => false,
    aiSearchBlocked: () => [],
    locales,
    hosts,
    homes: ['https://acme.com/'],
    projectName: 'Acme',
    domain: 'acme.com',
    previousRedirects: new Map(),
    now: Date.parse('2026-10-17T12:00:00Z'),
};

const url = 'https://acme.com/pricing';

const words = Array.from({ length: thinPageWords }, () => 'word').join(' ');

function entry(inSitemap = false): QueueEntry {
    return {
        url,
        depth: 1,
        state: 'queued',
        in_sitemap: inSitemap,
        inbound_links: 0,
        linked_from: [],
        alternates: null,
    };
}

function fetched(
    body: string,
    {
        hops = [{ url, status: 200 }],
        headers = {},
        bytes = 0,
        isTruncated = false,
    }: {
        hops?: Hop[];
        headers?: Record<string, string>;
        bytes?: number;
        isTruncated?: boolean;
    } = {},
): Fetched {
    return {
        ok: hops.at(-1)!.status < 300,
        status: hops.at(-1)!.status,
        url: hops.at(-1)!.url,
        headers: new Headers({
            'content-type': 'text/html',
            'content-encoding': 'gzip',
            ...headers,
        }),
        body,
        bytes,
        isUtf8: true,
        isTruncated,
        hops,
        headersMs: 0,
    };
}

const description =
    'Two plans for a team of any size, billed monthly or yearly, with every feature included.';

const openGraph = ['title', 'description', 'image', 'url', 'type']
    .map(
        (tag) =>
            `<meta property="og:${tag}" content="${tag === 'url' ? url : 'Pricing'}">`,
    )
    .join('');

function documentOf(
    head: string,
    body = `<main>${words}</main>`,
    lang = ' lang="en"',
) {
    return `<!doctype html><html${lang}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pricing</title><meta name="description" content="${description}">${openGraph}${head}</head><body><nav><a href="/">Home</a></nav><h1>Pricing</h1>${body}</body></html>`;
}

function html(head: string, body?: string) {
    return documentOf(`${head}<link rel="canonical" href="${url}">`, body);
}

function check(
    outcome: Read['outcome'],
    {
        inSitemap = false,
        pageIds = new Map<string, string>(),
        ...overrides
    }: Partial<PageCheckContext> & {
        inSitemap?: boolean;
        pageIds?: Map<string, string>;
    } = {},
) {
    const read: Read = { entry: entry(inSitemap), outcome };

    const observed = observeRead(read, {
        projectId: 'project',
        auditId: 'audit',
        locales,
        hosts,
        domain: 'acme.com',
        pageIds,
    });

    return checkPage(read, observed, { ...context, ...overrides });
}

function checks(...args: Parameters<typeof check>) {
    return check(...args).map((finding) => finding.check);
}

describe('checkPage', () => {
    it('finds nothing on an indexable page with its canonical, its language and enough words', () => {
        expect(checks(fetched(html('')))).toEqual([]);
    });

    it('finds nothing on a page robots.txt kept the audit from', () => {
        expect(checks('blocked')).toEqual([]);
    });

    it('reports a 5xx, a 429 after its retries and no answer as page-5xx, and any other 4xx as page-4xx', () => {
        expect(
            check(new Error('The operation was aborted due to timeout')),
        ).toEqual([
            {
                check: 'page-5xx',
                url,
                detail: { error: 'The operation was aborted due to timeout' },
            },
        ]);

        for (const status of [500, 503, 429]) {
            expect(checks(fetched('', { hops: [{ url, status }] }))).toEqual([
                'page-5xx',
            ]);
        }

        for (const status of [404, 410, 401, 403]) {
            expect(checks(fetched('', { hops: [{ url, status }] }))).toEqual([
                'page-4xx',
            ]);
        }
    });

    it('reports a chain of 2 to 10 redirects, and one that ends on an error', () => {
        const hop = (path: string, status: number) => ({
            url: `https://acme.com${path}`,
            status,
        });

        expect(
            checks(
                fetched('', { hops: [hop('/pricing', 301), hop('/new', 200)] }),
            ),
        ).toEqual([]);

        expect(
            checks(
                fetched('', {
                    hops: [
                        hop('/pricing', 301),
                        hop('/b', 302),
                        hop('/c', 200),
                    ],
                }),
            ),
        ).toEqual(['redirect-chain']);

        expect(
            checks(
                fetched('', {
                    hops: [hop('/pricing', 301), hop('/gone', 404)],
                }),
            ),
        ).toEqual(['redirect-to-error']);
    });

    it('reports a redirect still going after 10 hops as a long chain, and a URL that recurs as a loop alone', () => {
        const chain = Array.from({ length: 11 }, (_, i) => ({
            url: i === 0 ? url : `https://acme.com/step-${i}`,
            status: 301,
        }));

        expect(checks(fetched('', { hops: chain }))).toEqual([
            'redirect-chain-long',
        ]);

        const loop = Array.from({ length: 11 }, (_, i) => ({
            url: i % 2 === 0 ? url : 'https://acme.com/pricing/',
            status: 301,
        }));

        expect(check(fetched('', { hops: loop }))).toMatchObject([
            {
                check: 'redirect-loop',
                url,
                subject: 'https://acme.com/pricing/',
                detail: { hops: loop },
            },
        ]);
    });

    it('notes a redirect that only adds a slash or changes the case', () => {
        expect(
            checks(
                fetched('', {
                    hops: [
                        { url, status: 301 },
                        { url: 'https://acme.com/Pricing/', status: 200 },
                    ],
                }),
            ),
        ).toEqual(['redirect-slash-or-case']);
    });

    it('notes a 302, 303 or 307 whose target is the one the row held before this read', () => {
        const target = 'https://acme.com/new';

        const temporary = (status: number, previous: string) =>
            check(
                fetched('', {
                    hops: [
                        { url, status },
                        { url: target, status: 200 },
                    ],
                }),
                { previousRedirects: new Map([[url, previous]]) },
            );

        for (const status of [302, 303, 307]) {
            expect(temporary(status, target), String(status)).toEqual([
                {
                    check: 'redirect-temporary',
                    url,
                    subject: target,
                    detail: { status, target },
                },
            ]);
        }

        expect(temporary(301, target)).toEqual([]);
        expect(temporary(302, 'https://acme.com/other')).toEqual([]);

        expect(
            checks(
                fetched('', {
                    hops: [
                        { url, status: 302 },
                        { url: target, status: 200 },
                    ],
                }),
            ),
        ).toEqual([]);
    });

    it('runs the heuristics of indexability on the page it read', () => {
        expect(
            checks(
                fetched(
                    html(
                        '',
                        `<main>${words}</main><a href="/a?utm_source=x">a</a>`,
                    ),
                ),
            ),
        ).toEqual(['param-duplicates']);
    });

    it('reports HTML over 2 MB after decoding, a chunked answer with no Content-Length included', () => {
        expect(
            check(
                fetched(html(''), { bytes: maxBytes + 1, isTruncated: true }),
            ),
        ).toMatchObject([
            { check: 'html-over-2mb', detail: { bytes: maxBytes + 1 } },
        ]);

        expect(checks(fetched(html(''), { bytes: maxBytes }))).toEqual([]);
    });

    it('never reads the size of HTML from its Content-Length', () => {
        expect(
            checks(
                fetched(html(''), {
                    headers: { 'content-length': String(maxBytes + 1) },
                    bytes: 1_000,
                }),
            ),
        ).toEqual([]);

        const uncompressed = fetched(html(''), {
            headers: { 'content-length': String(maxBytes + 1) },
            bytes: 1_000,
        });

        uncompressed.headers.delete('content-encoding');

        expect(checks(uncompressed)).toEqual(['html-uncompressed']);
    });

    it('reports meta robots and X-Robots-Tag saying opposite things, never one that adds to the other', () => {
        expect(
            checks(
                fetched(html('<meta name="robots" content="index, follow">'), {
                    headers: { 'x-robots-tag': 'noindex' },
                }),
            ),
        ).toEqual(['robots-conflict']);

        expect(
            checks(
                fetched(html('<meta name="robots" content="all">'), {
                    headers: { 'x-robots-tag': 'noarchive' },
                }),
            ),
        ).toEqual(['noarchive']);
    });

    it('notes an invalid max-snippet or unavailable_after and the none directive', () => {
        expect(
            checks(
                fetched(
                    html(
                        '<meta name="robots" content="max-snippet: lots, unavailable_after: someday">',
                    ),
                ),
            ),
        ).toEqual(['robots-invalid']);

        expect(
            checks(
                fetched(html('<meta name="robots" content="max-snippet: -1">')),
            ),
        ).toEqual([]);

        expect(
            checks(fetched(html('<meta name="robots" content="none">'))),
        ).toEqual(['robots-none']);
    });

    it('reports an indexable page whose unavailable_after date has passed', () => {
        expect(
            checks(
                fetched(html(''), {
                    headers: {
                        'x-robots-tag': 'unavailable_after: 2026-01-01',
                    },
                }),
            ),
        ).toEqual(['unavailable-after-past']);

        expect(
            checks(
                fetched(html(''), {
                    headers: {
                        'x-robots-tag': 'unavailable_after: 2027-01-01',
                    },
                }),
            ),
        ).toEqual([]);
    });

    it('reads an unavailable_after date written as RFC 850 or RFC 822, so a past one is reported and none is invalid', () => {
        expect(
            checks(
                fetched(
                    html(
                        '<meta name="robots" content="unavailable_after: Thursday, 25-Jun-26 15:00:00 GMT">',
                    ),
                ),
            ),
        ).toEqual(['unavailable-after-past']);

        expect(
            checks(
                fetched(html(''), {
                    headers: {
                        'x-robots-tag':
                            'unavailable_after: Fri, 25 Jun 2027 15:00:00 GMT, follow',
                    },
                }),
            ),
        ).toEqual([]);

        expect(
            checks(
                fetched(
                    html(
                        '<meta name="googlebot" content="unavailable_after: Friday, 25-Jun-27 15:00:00 GMT">',
                    ),
                ),
            ),
        ).toEqual([]);
    });

    it('reports a noindex page robots.txt disallows only when the audit read past robots.txt', () => {
        const noindex = fetched(html('<meta name="robots" content="noindex">'));

        expect(
            checks(noindex, { obeyRobots: false, isDisallowed: () => true }),
        ).toEqual(['noindex-blocked']);

        expect(
            checks(noindex, { obeyRobots: true, isDisallowed: () => true }),
        ).toEqual([]);
    });

    it('asks about a noindex page that Citequill wrote or a sitemap lists', () => {
        const noindex = fetched(html('<meta name="robots" content="noindex">'));

        expect(checks(noindex, { inSitemap: true })).toEqual([
            'noindex-content',
        ]);

        expect(
            check(noindex, { pageIds: new Map([[url, 'page-1']]) }),
        ).toMatchObject([
            { check: 'noindex-content', detail: { isCitequillPage: true } },
        ]);

        expect(checks(noindex)).toEqual([]);
    });

    it('notes an indexable page with no canonical, by tag or by header', () => {
        const bare = documentOf('');

        expect(checks(fetched(bare))).toEqual(['canonical-missing']);

        expect(
            checks({
                ...fetched('%PDF-1.7'),
                headers: new Headers({ 'content-type': 'application/pdf' }),
            }),
        ).toEqual([]);

        expect(
            checks(
                fetched(bare, {
                    headers: { link: `<${url}>; rel="canonical"` },
                }),
            ),
        ).toEqual([]);
    });

    it('reports a canonical in the body, a relative one, and two that disagree', () => {
        const findings = check(
            fetched(
                documentOf(
                    '<link rel="canonical" href="/pricing#plans">',
                    `<main>${words}</main><link rel="canonical" id="late" href="https://acme.com/other">`,
                ),
            ),
        );

        expect(findings).toEqual([
            {
                check: 'canonical-outside-head',
                url,
                subject: 'https://acme.com/other',
                selector: 'link#late',
                snippet:
                    '<link rel="canonical" id="late" href="https://acme.com/other">',
            },
            {
                check: 'canonical-relative',
                url,
                subject: '/pricing#plans',
                selector: 'link',
                snippet: '<link rel="canonical" href="/pricing#plans">',
            },
            {
                check: 'canonical-conflict',
                url,
                subject: 'https://acme.com/pricing',
                detail: {
                    html: [
                        'https://acme.com/pricing',
                        'https://acme.com/other',
                    ],
                    header: null,
                },
            },
        ]);

        expect(
            checks(
                fetched(html(''), {
                    headers: { link: '<https://acme.com/b>; rel="canonical"' },
                }),
            ),
        ).toEqual(['canonical-conflict']);
    });

    it("reports a canonical to another locale's base URL or to http from https", () => {
        const pointing = (target: string) =>
            documentOf(`<link rel="canonical" href="${target}">`);

        expect(checks(fetched(pointing('https://acme.com/de/preise')))).toEqual(
            ['canonical-language', 'og-image-bad'],
        );

        expect(checks(fetched(pointing('http://acme.com/pricing')))).toEqual([
            'canonical-language',
            'og-image-bad',
        ]);

        expect(checks(fetched(pointing('https://acme.com/plans')))).toEqual([
            'og-image-bad',
        ]);
    });

    it('reports a meta refresh that moves the reader on, and not one that reloads', () => {
        expect(
            checks(
                fetched(
                    html('<meta http-equiv="refresh" content="0; url=/plans">'),
                ),
            ),
        ).toEqual(['redirect-meta']);

        expect(
            checks(fetched(html('<meta http-equiv="refresh" content="30">'))),
        ).toEqual([]);
    });

    it('notes a missing or invalid language, or one the hreflang self-entry contradicts', () => {
        const page = (lang: string, head = '') =>
            fetched(
                documentOf(
                    `<link rel="canonical" href="${url}">${head}`,
                    undefined,
                    lang,
                ),
            );

        expect(checks(page(''))).toEqual(['html-lang']);
        expect(checks(page(' lang="english language"'))).toEqual(['html-lang']);

        expect(
            checks(
                page(
                    ' lang="en"',
                    `<link rel="alternate" hreflang="de" href="${url}">`,
                ),
            ),
        ).toEqual(['html-lang']);

        expect(
            checks(
                page(
                    ' lang="en-GB"',
                    `<link rel="alternate" hreflang="en" href="${url}">`,
                ),
            ),
        ).toEqual([]);
    });

    it(`notes main content under ${thinPageWords} words`, () => {
        const short = fetched(html('', '<main>Too short.</main>'));

        expect(checks(short)).toEqual(['thin-page', 'text-ratio']);

        expect(check(short)[0]).toMatchObject({
            check: 'thin-page',
            detail: { words: 2 },
        });
    });

    it('runs the on-page, image, link and viewport checks on an indexable page only', () => {
        const bare = `<html lang="en"><head><link rel="canonical" href="${url}"></head><body><main>${words}</main><img src="/a.png"></body></html>`;

        expect(checks(fetched(bare))).toEqual([
            'title-missing',
            'description-missing',
            'h1-missing',
            'head-invalid',
            'og-missing',
            'img-no-dimensions',
            'img-alt-missing',
            'page-no-outlinks',
            'viewport-missing',
        ]);

        expect(
            checks(fetched(bare, { headers: { 'x-robots-tag': 'noindex' } })),
        ).toEqual([]);
    });

    it('runs the hreflang checks on an indexable page only, over its tags and its Link header', () => {
        const page = (headers: Record<string, string> = {}) =>
            fetched(
                html(`<link rel="alternate" hreflang="en-UK" href="${url}">`),
                {
                    headers: {
                        link: '<http://acme.com/de>; rel="alternate"; hreflang="de"',
                        ...headers,
                    },
                },
            );

        expect(checks(page())).toEqual([
            'hreflang-code',
            'hreflang-http',
            'hreflang-methods',
        ]);

        expect(checks(page({ 'x-robots-tag': 'noindex' }))).toEqual([]);
    });

    it('runs the hreflang checks on an indexable answer that is not HTML, over its Link header', () => {
        expect(
            checks(
                fetched('%PDF-1.7', {
                    headers: {
                        'content-type': 'application/pdf',
                        link: '<https://acme.com/xx/file.pdf>; rel="alternate"; hreflang="xx"',
                    },
                }),
            ),
        ).toEqual(['hreflang-code']);
    });
});

describe('checkPage, for AI access', () => {
    it('runs the robots.txt and directive checks of AI access on an indexable page only', () => {
        const blocked = { aiSearchBlocked: () => ['PerplexityBot'] };

        const page = (robots: string) =>
            fetched(html(`<meta name="robots" content="${robots}">`));

        expect(checks(page('noarchive, max-snippet:50'), blocked)).toEqual([
            'ai-search-bots-blocked',
            'max-snippet-small',
            'noarchive',
        ]);

        expect(checks(page('noindex, noarchive'), blocked)).toEqual([]);
    });

    it('reads max-snippet with a space after the colon as a valid limit, so it is max-snippet-small and not robots-invalid', () => {
        expect(
            check(
                fetched(html('<meta name="robots" content="max-snippet: 50">')),
            ),
        ).toEqual([
            {
                check: 'max-snippet-small',
                url,
                detail: { directives: ['max-snippet: 50'] },
            },
        ]);
    });
});

describe('checkPage, for structured data', () => {
    it('runs the structured data checks on an indexable page only, with the project name for a self review', () => {
        const page = (head = '') =>
            fetched(
                html(
                    `${head}<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Pricing","address":"Main St 1","aggregateRating":{"@type":"AggregateRating","ratingValue":5,"ratingCount":9}}</script>`,
                ),
            );

        expect(checks(page(), { projectName: 'Pricing' })).toEqual([
            'jsonld-self-review',
            'jsonld-recommended-missing',
        ]);

        expect(checks(page())).toEqual(['jsonld-recommended-missing']);

        expect(checks(page('<meta name="robots" content="noindex">'))).toEqual(
            [],
        );
    });

    it('hints at JSON-LD on an indexable page with microdata and no JSON-LD block', () => {
        expect(
            checks(fetched(html('', `<main itemscope>${words}</main>`))),
        ).toEqual(['structured-data-format']);
    });
});

describe('checkPage, for HTTPS', () => {
    const fetchFailed = (code: string) =>
        Object.assign(new TypeError('fetch failed'), {
            cause: Object.assign(new Error('certificate has expired'), {
                code,
            }),
        });

    it('reports a request that fails on the certificate or the TLS version as tls-invalid with its code and the message of its cause, never page-5xx', () => {
        expect(check(fetchFailed('CERT_HAS_EXPIRED'))).toEqual([
            {
                check: 'tls-invalid',
                url,
                detail: {
                    code: 'CERT_HAS_EXPIRED',
                    error: 'certificate has expired',
                },
            },
        ]);

        expect(
            check(
                Object.assign(new Error('unsupported protocol'), {
                    code: 'ERR_SSL_UNSUPPORTED_PROTOCOL',
                }),
            ),
        ).toEqual([
            {
                check: 'tls-invalid',
                url,
                detail: {
                    code: 'ERR_SSL_UNSUPPORTED_PROTOCOL',
                    error: 'unsupported protocol',
                },
            },
        ]);

        expect(checks(fetchFailed('ERR_SSL_UNSUPPORTED_PROTOCOL'))).toEqual([
            'tls-invalid',
        ]);

        expect(checks(fetchFailed('ECONNREFUSED'))).toEqual(['page-5xx']);
    });

    it('reports an http page that answers 200 as served over HTTP, on its own and indexable or not', () => {
        const page = 'http://acme.com/pricing';

        const read: Read = {
            entry: { ...entry(), url: page },
            outcome: fetched(html('').replaceAll('https:', 'http:'), {
                hops: [{ url: page, status: 200 }],
                headers: { 'x-robots-tag': 'noindex' },
            }),
        };

        const observed = observeRead(read, {
            projectId: 'project',
            auditId: 'audit',
            locales,
            hosts,
            domain: 'acme.com',
            pageIds: new Map(),
        });

        expect(checkPage(read, observed, context)).toContainEqual({
            check: 'https-missing',
            url: page,
            detail: { reason: 'served' },
        });
    });

    it('reports a redirect from https to http at any hop, on the first http hop', () => {
        const hops = [
            { url, status: 301 },
            { url: 'https://www.acme.com/pricing', status: 301 },
            { url: 'http://www.acme.com/pricing', status: 301 },
            { url: 'https://www.acme.com/pricing/', status: 200 },
        ];

        expect(check(fetched('', { hops }))).toContainEqual({
            check: 'https-to-http',
            url,
            subject: 'http://www.acme.com/pricing',
            detail: { hops },
        });

        expect(
            checks(
                fetched('', {
                    hops: [
                        { url: 'http://acme.com/pricing', status: 301 },
                        { url, status: 200 },
                    ],
                }),
            ),
        ).not.toContain('https-to-http');
    });

    it('reports a 200 whose Content-Type is not HTML while its body is, and leaves the page unparsed', () => {
        expect(
            check(
                fetched(`\uFEFF \n<!DOCTYPE html>${html('')}`, {
                    headers: { 'content-type': 'text/plain' },
                }),
            ),
        ).toEqual([
            {
                check: 'content-type-wrong',
                url,
                detail: { contentType: 'text/plain' },
            },
        ]);

        expect(
            checks(
                fetched('%PDF-1.7', {
                    headers: { 'content-type': 'application/pdf' },
                }),
            ),
        ).toEqual([]);

        const missing = fetched(html(''));

        missing.headers.delete('content-type');

        expect(checks(missing)).toEqual([]);
    });

    it('reads the security headers on a home page only', () => {
        const home = 'https://acme.com/';

        const read = (headers: Record<string, string>): Read => ({
            entry: { ...entry(), url: home },
            outcome: fetched(html(''), {
                hops: [{ url: home, status: 200 }],
                headers,
            }),
        });

        const homeChecks = (headers: Record<string, string>) =>
            checkPage(
                read(headers),
                observeRead(read(headers), {
                    projectId: 'project',
                    auditId: 'audit',
                    locales,
                    hosts,
                    domain: 'acme.com',
                    pageIds: new Map(),
                }),
                context,
            ).filter((finding) => finding.check === 'security-headers');

        expect(homeChecks({})).toEqual([
            {
                check: 'security-headers',
                url: home,
                detail: {
                    missing: [
                        'strict-transport-security',
                        'content-security-policy',
                        'x-content-type-options',
                        'x-frame-options',
                        'referrer-policy',
                    ],
                },
            },
        ]);

        expect(checks(fetched(html('')))).not.toContain('security-headers');
    });

    it('runs the article checks on an indexable article page, and no check of the shape on a page with noindex', () => {
        const article =
            '<script type="application/ld+json">{"@context": "https://schema.org", "@type": "Article", "headline": "Pricing"}</script>';

        expect(
            checks(fetched(html(article))).filter(
                (id) => !id.startsWith('jsonld-'),
            ),
        ).toEqual(['geo-qa-structure', 'geo-source-links']);

        expect(
            checks(
                fetched(
                    html(`${article}<meta name="robots" content="noindex">`),
                ),
            ).filter((id) => id.startsWith('geo-') || id === 'answer-first'),
        ).toEqual([]);
    });
});

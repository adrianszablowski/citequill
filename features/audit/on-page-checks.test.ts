import { describe, expect, it } from 'vitest';

import {
    onPageChecks,
    openGraphTags,
    repeatedWord,
    staleDays,
} from '@/features/audit/on-page-checks';
import { readAuditPage } from '@/features/audit/page';

const url = 'https://acme.com/pricing';

const now = Date.parse('2026-10-18T12:00:00Z');

const description =
    'Two plans for a team of any size, billed monthly or yearly, with every feature included.';

const openGraph = openGraphTags
    .map((tag) => `<meta property="${tag}" content="Pricing">`)
    .join('');

const text = Array.from({ length: 60 }, () => 'Plans for teams.').join(' ');

function page({
    title = '<title>Pricing | Acme</title>',
    head = '',
    body = `<h1>Pricing</h1><h2>Plans</h2><p>${text}</p>`,
    doctype = '<!doctype html>',
} = {}) {
    return `${doctype}<html lang="en"><head><meta charset="utf-8">${title}<meta name="description" content="${description}">${openGraph}${head}</head><body>${body}</body></html>`;
}

function check(
    html: string,
    {
        at = url,
        headers = {},
    }: { at?: string; headers?: Record<string, string> } = {},
) {
    return onPageChecks(
        at,
        readAuditPage(html, at),
        { headers: new Headers(headers) },
        now,
    );
}

function checks(...args: Parameters<typeof check>) {
    return check(...args).map((finding) => finding.check);
}

describe('onPageChecks', () => {
    it('finds nothing on a complete page', () => {
        expect(check(page())).toEqual([]);
    });

    it('reports a page with no title, an empty one, several, or one outside the head, once', () => {
        const reason = (html: string) =>
            check(html)
                .filter(({ check }) => check === 'title-missing')
                .map(({ detail }) => detail);

        expect(reason(page({ title: '' }))).toEqual([
            { reason: 'none', count: 0 },
        ]);

        expect(reason(page({ title: '<title>  </title>' }))).toEqual([
            { reason: 'empty', count: 1 },
        ]);

        expect(
            reason(page({ title: '<title>A</title><title>B</title>' })),
        ).toEqual([{ reason: 'several', count: 2 }]);

        expect(
            reason(
                page({
                    title: '',
                    body: '<h1>Pricing</h1><title>Late</title>',
                }),
            ),
        ).toEqual([{ reason: 'outside-head', count: 1 }]);
    });

    it('counts no title of an inline svg as a page title', () => {
        expect(
            checks(
                page({
                    body: '<h1>Pricing</h1><svg role="img"><title>Logo</title></svg>',
                }),
            ),
        ).not.toContain('title-missing');
    });

    it('reports a title that repeats a word of 4 or more letters 3 times, whatever its case and punctuation', () => {
        const stuffed = check(
            page({
                title: '<title>Shoes, SHOES and shoes! | Acme</title>',
            }),
        );

        expect(stuffed).toMatchObject([
            { check: 'title-stuffed', detail: { word: 'shoes' } },
        ]);

        expect(
            checks(page({ title: '<title>Tea for two, tea for all</title>' })),
        ).toEqual([]);
    });

    it('reports a title wider than 600 px, with its width', () => {
        const wide = check(
            page({
                title: '<title>Księgowość dla małych firm w Warszawie: cennik, opinie i porady | Biuro Rachunkowe Kowalski</title>',
            }),
        );

        expect(wide).toMatchObject([{ check: 'title-width' }]);

        expect((wide[0].detail as { width: number }).width).toBeGreaterThan(
            600,
        );
    });

    it('reports a description that is missing, repeated, empty or outside the head, read whatever the case of its name', () => {
        const withDescription = (head: string, body = '<h1>Pricing</h1>') =>
            page({ body }).replace(
                `<meta name="description" content="${description}">`,
                head,
            );

        const reasons = (html: string) =>
            check(html)
                .filter(({ check }) => check === 'description-missing')
                .map(({ detail }) => (detail as { reason: string }).reason);

        expect(reasons(withDescription(''))).toEqual(['none']);

        expect(
            reasons(
                withDescription(
                    `<meta name="Description" content="${description}"><meta name="DESCRIPTION" content="Other">`,
                ),
            ),
        ).toEqual(['several']);

        expect(
            reasons(withDescription('<meta name="description" content=" ">')),
        ).toEqual(['empty']);

        expect(
            reasons(
                withDescription(
                    '',
                    `<h1>Pricing</h1><meta name="description" content="${description}">`,
                ),
            ),
        ).toEqual(['outside-head']);
    });

    it('notes a description under 70 or over 160 characters, and only when there is one in the head', () => {
        const sized = (length: number) =>
            check(page().replace(description, 'a'.repeat(length)));

        expect(sized(69)).toMatchObject([
            { check: 'description-length', detail: { length: 69 } },
        ]);

        expect(sized(70)).toEqual([]);
        expect(sized(160)).toEqual([]);

        expect(checks(page().replace(description, 'a'.repeat(161)))).toEqual([
            'description-length',
        ]);
    });

    it('reports a page with no H1 or an empty one, and notes several or one over 70 characters', () => {
        expect(checks(page({ body: `<p>${text}</p>` }))).toEqual([
            'h1-missing',
        ]);

        expect(checks(page({ body: `<h1> \n </h1><p>${text}</p>` }))).toEqual([
            'h1-missing',
        ]);

        expect(
            check(page({ body: `<h1>One</h1><h1>Two</h1><p>${text}</p>` })),
        ).toMatchObject([
            { check: 'h1-count', detail: { count: 2, length: 3 } },
        ]);

        expect(
            checks(page({ body: `<h1>${'a'.repeat(71)}</h1><p>${text}</p>` })),
        ).toEqual(['h1-count']);
    });

    it('notes the first heading that skips a level, the first one measured against an h1', () => {
        const order = (body: string) =>
            check(page({ body: `${body}<p>${text}</p>` })).filter(
                ({ check }) => check === 'heading-order',
            );

        expect(
            order('<h1>A</h1><h2>B</h2><h4 class="x">C</h4><h6>D</h6>'),
        ).toEqual([
            {
                check: 'heading-order',
                url,
                selector: 'h4.x',
                snippet: '<h4 class="x">C</h4>',
                detail: { level: 4, previous: 2 },
            },
        ]);

        expect(order('<h2>A</h2><h1>B</h1><h2>C</h2><h3>D</h3>')).toEqual([]);
        expect(order('<h3>A</h3><h1>B</h1>')).toHaveLength(1);
    });

    it('reports a missing doctype, a missing charset, and a head element pushed into the body by one the head does not allow', () => {
        const broken = check(
            page({
                doctype: '',
                head: '<div>Banner</div><link rel="alternate" hreflang="de" href="/de">',
            }).replace('<meta charset="utf-8">', ''),
        ).filter(({ check }) => check === 'head-invalid');

        expect(broken).toEqual([
            {
                check: 'head-invalid',
                url,
                selector: 'link',
                snippet: '<link rel="alternate" hreflang="de" href="/de">',
                detail: {
                    reasons: ['doctype', 'charset', 'head-element-in-body'],
                },
            },
        ]);
    });

    it('takes the charset from the Content-Type header, and leaves a style or link written in the body alone', () => {
        const html = page({
            body: `<h1>Pricing</h1><style>.a{}</style><link rel="stylesheet" href="/late.css"><meta itemprop="price" content="9"><p>${text}</p>`,
        }).replace('<meta charset="utf-8">', '');

        expect(
            checks(html, {
                headers: { 'content-type': 'text/html; charset=UTF-8' },
            }),
        ).toEqual([]);

        expect(checks(html)).toEqual(['head-invalid']);
    });

    it('reports placeholder text in the visible text, never in a script', () => {
        const lorem = check(
            page({
                body: `<h1>Pricing</h1><p>${text}</p><p>Lorem ipsum dolor sit amet.</p><script>var t = "dolor sit amet";</script>`,
            }),
        );

        expect(lorem).toMatchObject([{ check: 'lorem-ipsum' }]);
        expect(lorem[0].snippet).toContain('Lorem ipsum dolor sit amet.');

        expect(
            checks(
                page({
                    body: `<h1>Pricing</h1><p>${text}</p><script>var t = "lorem ipsum";</script>`,
                }),
            ),
        ).toEqual([]);
    });

    it('notes frames, applets and Flash, Java or Silverlight objects, and not a PDF or a video', () => {
        const plugins = check(
            page({
                body: `<h1>Pricing</h1><p>${text}</p><object id="ad" data="/banner.SWF?v=2"></object><embed type="application/x-java-applet;version=1.6"><applet code="A.class"></applet>`,
            }),
        );

        expect(plugins).toEqual([
            {
                check: 'plugins',
                url,
                selector: 'object#ad',
                snippet: '<object id="ad" data="/banner.SWF?v=2"></object>',
                detail: { elements: ['object', 'embed', 'applet'] },
            },
        ]);

        expect(
            checks(
                page({
                    body: `<h1>Pricing</h1><p>${text}</p><object data="/menu.pdf" type="application/pdf"></object><embed src="/clip.mp4">`,
                }),
            ),
        ).toEqual([]);
    });

    it('notes visible text under 10% of the HTML, and leaves scripts and styles out of the HTML', () => {
        const heavy = check(
            page({
                body: `<h1>Pricing</h1><p>Short.</p>${'<div class="row"></div>'.repeat(300)}`,
            }),
        );

        expect(heavy).toMatchObject([{ check: 'text-ratio' }]);
        expect((heavy[0].detail as { ratio: number }).ratio).toBeLessThan(0.1);

        expect(
            checks(
                page({
                    body: `<h1>Pricing</h1><p>${text}</p><script>${'x'.repeat(50_000)}</script><style>${'y'.repeat(50_000)}</style>`,
                }),
            ),
        ).toEqual([]);
    });

    it(`notes a page whose newest modification date is over ${staleDays} days old`, () => {
        const old = new Date(now - (staleDays + 1) * 86_400_000);
        const recent = new Date(now - 10 * 86_400_000);

        const modified = (time: Date) =>
            page({
                head: `<meta property="article:modified_time" content="${time.toISOString()}">`,
            });

        expect(
            check(page(), { headers: { 'last-modified': old.toUTCString() } }),
        ).toEqual([
            {
                check: 'content-stale',
                url,
                detail: {
                    lastModified: old.toUTCString(),
                    modifiedTime: null,
                    dateModified: null,
                },
            },
        ]);

        expect(checks(modified(old))).toEqual(['content-stale']);

        expect(
            checks(modified(recent), {
                headers: { 'last-modified': old.toUTCString() },
            }),
        ).toEqual([]);

        expect(
            checks(page(), { headers: { 'last-modified': 'yesterday' } }),
        ).toEqual([]);
    });

    it('reads every dateModified of the JSON-LD, so a fresh one nested in an FAQ answer saves an old page, and skips one that does not parse', () => {
        const old = new Date(now - (staleDays + 1) * 86_400_000).toISOString();
        const recent = new Date(now - 10 * 86_400_000).toISOString();

        const jsonLd = (value: unknown) =>
            page({
                head: `<script type="application/ld+json">${JSON.stringify(value)}</script>`,
            });

        const faq = {
            '@context': 'https://schema.org',
            '@graph': [
                { '@type': 'Article', dateModified: old },
                {
                    '@type': 'FAQPage',
                    mainEntity: {
                        '@type': 'Question',
                        acceptedAnswer: {
                            '@type': 'Answer',
                            dateModified: recent,
                        },
                    },
                },
            ],
        };

        const lastModified = { 'last-modified': new Date(old).toUTCString() };

        expect(checks(jsonLd(faq), { headers: lastModified })).toEqual([]);

        expect(
            check(jsonLd({ '@type': 'Article', dateModified: old })),
        ).toEqual([
            {
                check: 'content-stale',
                url,
                detail: {
                    lastModified: null,
                    modifiedTime: null,
                    dateModified: old,
                },
            },
        ]);

        expect(
            check(
                jsonLd([
                    { '@type': 'Article', dateModified: 'last week' },
                    { '@type': 'WebPage', dateModified: old },
                ]),
            ).map(({ detail }) => detail),
        ).toEqual([
            { lastModified: null, modifiedTime: null, dateModified: old },
        ]);

        expect(
            checks(jsonLd({ '@type': 'Article', dateModified: 'last week' })),
        ).toEqual([]);
    });

    it('notes a URL with an underscore, an uppercase letter, a double slash, over 4 parameters or over 115 characters, and not a Polish slug', () => {
        const reasons = (at: string) =>
            check(page(), { at }).map(({ detail }) => detail);

        expect(
            reasons('https://acme.com/My_Page//x?a=1&b=2&c=3&d=4&e=5'),
        ).toEqual([
            {
                reasons: [
                    'underscore',
                    'uppercase',
                    'double-slash',
                    'parameters',
                ],
            },
        ]);

        expect(reasons(`https://acme.com/${'a'.repeat(100)}`)).toEqual([
            { reasons: ['length'] },
        ]);

        expect(
            reasons(
                'https://acme.com/ksi%C4%99gowo%C5%9B%C4%87-dla-ma%C5%82ych-firm',
            ),
        ).toEqual([]);
    });

    it('notes the Open Graph tags a page lacks, read from property or name', () => {
        const partial = page().replace(
            openGraph,
            '<meta name="OG:Title" content="Pricing"><meta property="og:image" content="">',
        );

        expect(check(partial)).toEqual([
            {
                check: 'og-missing',
                url,
                detail: {
                    missing: [
                        'og:description',
                        'og:image',
                        'og:url',
                        'og:type',
                    ],
                },
            },
        ]);
    });
});

describe('onPageChecks, for og:url', () => {
    const tagged = (ogUrl: string, head = '') =>
        `<html><head><meta property="og:url" content="${ogUrl}">${head}</head><body></body></html>`;

    const ogUrl = (html: string, headers: Record<string, string> = {}) =>
        check(html, { headers }).filter(
            (finding) => finding.check === 'og-image-bad',
        );

    it('reports an og:url that differs from the canonical, by tag or by header', () => {
        expect(
            ogUrl(tagged('/', `<link rel="canonical" href="${url}">`)),
        ).toEqual([
            {
                check: 'og-image-bad',
                url,
                subject: 'https://acme.com/',
                detail: { reason: 'url', canonical: url },
            },
        ]);

        expect(
            ogUrl(tagged('https://acme.com/other'), {
                link: `<${url}>; rel="canonical"`,
            }),
        ).toHaveLength(1);
    });

    it('passes an og:url equal to the canonical, and a page with no canonical or no og:url', () => {
        expect(
            ogUrl(tagged('/pricing', `<link rel="canonical" href="${url}">`)),
        ).toEqual([]);

        expect(ogUrl(tagged('https://acme.com/other'))).toEqual([]);

        expect(
            ogUrl(
                `<html><head><link rel="canonical" href="${url}"></head></html>`,
            ),
        ).toEqual([]);
    });
});

describe('repeatedWord', () => {
    it('finds a word of 4 or more letters said 3 times, Polish letters included', () => {
        expect(repeatedWord('Żółw, żółw i ŻÓŁW')).toBe('żółw');
        expect(repeatedWord('kot kot kot')).toBeNull();
        expect(repeatedWord('')).toBeNull();
    });
});

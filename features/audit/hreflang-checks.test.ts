import { describe, expect, it } from 'vitest';

import { findingsPerPage } from '@/features/audit/finding';
import {
    alternatesListed,
    hreflangChecks,
    hreflangSiteChecks,
    isValidHreflang,
} from '@/features/audit/hreflang-checks';
import { alternateSets } from '@/features/audit/observe';
import { readAuditPage } from '@/features/audit/page';
import { siteHosts } from '@/features/audit/queue';
import type { SiteRow } from '@/features/audit/site-checks';
import type { Alternate } from '@/features/crawl/html';

const url = 'https://acme.com/pricing';
const de = 'https://acme.com/de/preise';

function tag(lang: string, href: string) {
    return `<link rel="alternate" hreflang="${lang}" href="${href}">`;
}

function checksOf(
    head: string,
    {
        link = null,
        sitemap = null,
        pageUrl = url,
    }: {
        link?: string | null;
        sitemap?: { lang: string; href: string }[] | null;
        pageUrl?: string;
    } = {},
) {
    const page = readAuditPage(
        `<html><head>${head}</head><body></body></html>`,
        pageUrl,
    );

    return hreflangChecks(
        pageUrl,
        page,
        alternateSets(page, new Headers(link ? { link } : {}), {
            url: pageUrl,
            alternates: sitemap,
        }),
    );
}

function only(check: string, findings: ReturnType<typeof checksOf>) {
    return findings.filter((finding) => finding.check === check);
}

const cluster = `${tag('en', url)}${tag('de', de)}${tag('x-default', url)}`;

describe('isValidHreflang', () => {
    it('accepts a language, with a script and a region in any case, and x-default', () => {
        for (const lang of [
            'en',
            'en-GB',
            'zh-Hant',
            'zh-Hans-US',
            'x-default',
            'X-Default',
            'EN-gb',
        ]) {
            expect(isValidHreflang(lang), lang).toBe(true);
        }
    });

    it('refuses an unknown language, a region alone, EU, UN and UK, a numeric region, a three-letter code, an underscore and an empty value', () => {
        for (const lang of [
            'xx',
            'en-EU',
            'en-UK',
            'en-UN',
            'GB',
            'es-419',
            'fil',
            'en_GB',
            'en-',
            '',
        ]) {
            expect(isValidHreflang(lang), lang).toBe(false);
        }
    });
});

describe('hreflangChecks', () => {
    it('finds nothing on a page whose tags form a valid set, and nothing on a page with no alternates, a canonical with hreflang included', () => {
        expect(checksOf(cluster)).toEqual([]);

        expect(
            checksOf(`<link rel="canonical" hreflang="en" href="${url}">`),
        ).toEqual([]);
    });

    it('reports every bad code and every relative URL of every method once, with the tag where it came from the HTML', () => {
        const findings = only(
            'hreflang-code',
            checksOf(
                `${cluster}${tag('en-UK', 'https://acme.com/uk')}${tag('xx', 'https://acme.com/xx')}${tag('xx', 'https://acme.com/xx')}${tag('fr', '/fr')}`,
                {
                    link: '</it>; rel="alternate"; hreflang="it"',
                    sitemap: [
                        { lang: 'gb', href: 'https://acme.com/gb' },
                        { lang: 'en', href: url },
                    ],
                },
            ),
        );

        expect(findings).toEqual([
            {
                check: 'hreflang-code',
                url,
                subject: 'https://acme.com/uk',
                selector: 'link',
                snippet: tag('en-UK', 'https://acme.com/uk'),
                detail: { lang: 'en-UK', reason: 'region', method: 'tags' },
            },
            expect.objectContaining({
                subject: 'https://acme.com/xx',
                detail: { lang: 'xx', reason: 'code', method: 'tags' },
            }),
            expect.objectContaining({
                subject: '/fr',
                detail: { lang: 'fr', reason: 'relative', method: 'tags' },
            }),
            {
                check: 'hreflang-code',
                url,
                subject: '/it',
                detail: { lang: 'it', reason: 'relative', method: 'header' },
            },
            {
                check: 'hreflang-code',
                url,
                subject: 'https://acme.com/gb',
                detail: { lang: 'gb', reason: 'code', method: 'sitemap' },
            },
        ]);
    });

    it(`reports at most ${findingsPerPage} bad entries of a page, with the total`, () => {
        const tags = Array.from({ length: findingsPerPage + 5 }, (_, i) =>
            tag('xx', `https://acme.com/${i}`),
        ).join('');

        const findings = checksOf(`${tag('x-default', url)}${tags}`);

        expect(findings).toHaveLength(findingsPerPage);

        expect(findings[0].detail).toMatchObject({
            total: findingsPerPage + 5,
        });
    });

    it('reports an alternate over http on a page over https, by any method, and none on a page over http', () => {
        const http = 'http://acme.com/de/preise';

        expect(
            only(
                'hreflang-http',
                checksOf(`${tag('en', url)}${tag('de', http)}`, {
                    sitemap: [{ lang: 'de', href: http }],
                }),
            ),
        ).toEqual([
            {
                check: 'hreflang-http',
                url,
                subject: http,
                selector: 'link',
                snippet: tag('de', http),
                detail: { method: 'tags' },
            },
            {
                check: 'hreflang-http',
                url,
                subject: http,
                detail: { method: 'sitemap' },
            },
        ]);

        expect(
            only(
                'hreflang-http',
                checksOf(`${tag('en', 'http://acme.com/')}${tag('de', http)}`, {
                    pageUrl: 'http://acme.com/',
                }),
            ),
        ).toEqual([]);
    });

    it('hints at a missing x-default when the set names two languages or more, and not for regions of one language', () => {
        expect(
            only(
                'hreflang-x-default',
                checksOf(
                    `${tag('en', url)}${tag('de-AT', de)}${tag('de', de)}`,
                ),
            ),
        ).toEqual([
            {
                check: 'hreflang-x-default',
                url,
                detail: { languages: ['en', 'de'] },
            },
        ]);

        expect(
            only(
                'hreflang-x-default',
                checksOf(`${tag('en-GB', url)}${tag('en-US', de)}`),
            ),
        ).toEqual([]);

        expect(only('hreflang-x-default', checksOf(cluster))).toEqual([]);
    });

    it('counts only valid codes as languages, so a bad code is one hreflang-code finding and no x-default hint', () => {
        expect(
            checksOf(`${tag('en', url)}${tag('xx', de)}`).map(
                ({ check }) => check,
            ),
        ).toEqual(['hreflang-code']);
    });

    it('reports an href that does not resolve, and takes a tag without href for no alternate', () => {
        expect(checksOf(tag('fr', 'javascript:void(0)'))).toEqual([
            {
                check: 'hreflang-code',
                url,
                subject: 'javascript:void(0)',
                selector: 'link',
                snippet: tag('fr', 'javascript:void(0)'),
                detail: { lang: 'fr', reason: 'relative', method: 'tags' },
            },
        ]);

        expect(checksOf('<link rel="alternate" hreflang="fr">')).toEqual([]);
    });

    it('hints at an hreflang attribute on the canonical tag, with the tag', () => {
        const canonical = `<link rel="canonical" hreflang="en" href="${url}">`;

        expect(
            only('hreflang-on-canonical', checksOf(`${canonical}${cluster}`)),
        ).toEqual([
            {
                check: 'hreflang-on-canonical',
                url,
                subject: url,
                selector: 'link',
                snippet: canonical,
            },
        ]);
    });

    it('reports methods that name different sets, and passes methods that agree on language and absolute URL in any case', () => {
        const same = [
            { lang: 'en', href: url },
            { lang: 'de', href: de },
            { lang: 'x-default', href: url },
        ];

        expect(
            only(
                'hreflang-methods',
                checksOf(
                    `${tag('EN', url)}${tag('de', '/de/preise')}${tag('x-default', url)}`,
                    { sitemap: same },
                ),
            ),
        ).toEqual([]);

        expect(
            only(
                'hreflang-methods',
                checksOf(cluster, {
                    link: `<${de}>; rel="alternate"; hreflang="de"`,
                    sitemap: same,
                }),
            ),
        ).toEqual([
            {
                check: 'hreflang-methods',
                url,
                detail: { methods: ['tags', 'header', 'sitemap'] },
            },
        ]);

        expect(
            only('hreflang-methods', checksOf('', { sitemap: same })),
        ).toEqual([]);
    });
});

const hosts = siteHosts('acme.com', ['https://acme.com']);

function row(path: string, overrides: Partial<SiteRow> = {}): SiteRow {
    const rowUrl = `https://acme.com${path}`;

    return {
        id: path,
        url: rowUrl,
        status_code: 200,
        redirect_to: null,
        is_indexable: true,
        is_blocked: false,
        canonical_url: rowUrl,
        in_sitemap: true,
        image_count: 0,
        external_link_count: 0,
        hreflang_count: 0,
        jsonld_count: 0,
        has_microdata: false,
        hreflang: [],
        click_depth: 1,
        inbound_links: 1,
        body_hash: null,
        body_simhash: null,
        title: null,
        description: null,
        ...overrides,
    };
}

function set(...paths: string[]) {
    return paths.map((path, i) => ({
        lang: ['en', 'de', 'fr', 'it'][i],
        href: path.startsWith('http') ? path : `https://acme.com${path}`,
    }));
}

function siteFindings(
    rows: SiteRow[],
    sitemap: Record<string, Alternate[]> = {},
) {
    return hreflangSiteChecks(rows, {
        hosts,
        sitemapAlternates: new Map(
            Object.entries(sitemap).map(([path, alternates]) => [
                `https://acme.com${path}`,
                alternates,
            ]),
        ),
    }).map(({ check, url: page, subject, detail }) => ({
        check,
        page,
        subject,
        detail,
    }));
}

describe('hreflangSiteChecks', () => {
    it('finds nothing in a two-page cluster that lists itself and agrees, by tags or by sitemap', () => {
        expect(
            siteFindings([
                row('/en', { hreflang: set('/en', '/de') }),
                row('/de', { hreflang: set('/en', '/de') }),
            ]),
        ).toEqual([]);

        expect(
            siteFindings([row('/en'), row('/de')], {
                '/en': set('/en', '/de'),
                '/de': set('/en', '/de'),
            }),
        ).toEqual([]);
    });

    it('reports an alternate that answered 200 and does not link back, on the page that lists it', () => {
        expect(
            siteFindings([
                row('/en', { hreflang: set('/en', '/de') }),
                row('/de', { hreflang: set('/de') }),
            ]),
        ).toEqual([
            {
                check: 'hreflang-return',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/de',
                detail: { reason: 'return', notListed: 'https://acme.com/en' },
            },
        ]);
    });

    it('reports a page whose set leaves itself out, and the alternate whose set then differs', () => {
        const findings = siteFindings([
            row('/en', { hreflang: set('/de', '/fr') }),
            row('/de', { hreflang: set('/en', '/de', '/fr') }),
        ]).filter(({ page }) => page === 'https://acme.com/en');

        expect(findings).toEqual([
            {
                check: 'hreflang-return',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/en',
                detail: { reason: 'self' },
            },
            {
                check: 'hreflang-return',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/de',
                detail: {
                    reason: 'differs',
                    listed: ['https://acme.com/de', 'https://acme.com/fr'],
                    listedBack: [
                        'https://acme.com/en',
                        'https://acme.com/de',
                        'https://acme.com/fr',
                    ],
                },
            },
        ]);
    });

    it(`lists at most ${alternatesListed} URLs of each set when two sets differ`, () => {
        const paths = Array.from(
            { length: alternatesListed + 2 },
            (_, i) => `/p${i}`,
        );

        const many = paths.map((path) => ({
            lang: 'en',
            href: `https://acme.com${path}`,
        }));

        const [first] = siteFindings([
            row('/p0', { hreflang: many }),
            row('/p1', { hreflang: many.slice(0, 2) }),
        ]).filter(({ page }) => page === 'https://acme.com/p0');

        expect(first.detail).toMatchObject({ reason: 'differs' });

        expect((first.detail as { listed: string[] }).listed).toHaveLength(
            alternatesListed,
        );
    });

    it('reports an alternate that carries noindex, redirects or errs, or names another canonical, with what it answered', () => {
        const findings = siteFindings([
            row('/en', {
                hreflang: set('/en', '/de', '/fr', '/it'),
            }),
            row('/de', {
                is_indexable: false,
                hreflang: set('/en', '/de', '/fr', '/it'),
            }),
            row('/fr', {
                status_code: 301,
                redirect_to: 'https://acme.com/fr/',
                is_indexable: false,
                canonical_url: null,
            }),
            row('/it', {
                canonical_url: 'https://acme.com/it/',
                hreflang: set('/en', '/de', '/fr', '/it'),
            }),
        ]).filter(({ page }) => page === 'https://acme.com/en');

        expect(findings).toEqual([
            {
                check: 'hreflang-target',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/de',
                detail: { status: 200, redirectTo: null, isIndexable: false },
            },
            {
                check: 'hreflang-target',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/fr',
                detail: {
                    status: 301,
                    redirectTo: 'https://acme.com/fr/',
                    isIndexable: false,
                },
            },
            {
                check: 'hreflang-target-canonical',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/it',
                detail: { canonical: 'https://acme.com/it/' },
            },
        ]);
    });

    it('says nothing of an alternate the audit never read, robots.txt kept out or another host serves', () => {
        expect(
            siteFindings([
                row('/en', {
                    hreflang: set(
                        '/en',
                        '/unread',
                        '/blocked',
                        'https://acme.de/',
                    ),
                }),
                row('/blocked', {
                    status_code: null,
                    is_indexable: false,
                    is_blocked: true,
                    canonical_url: null,
                }),
            ]),
        ).toEqual([]);
    });

    it('reports a sitemap entry that leaves itself out, an alternate whose own entry does not list it back, and one that lists a different set, and says nothing of an alternate the queue never took', () => {
        expect(
            siteFindings([row('/en'), row('/de'), row('/fr')], {
                '/en': set('/de', '/fr', '/it', 'https://acme.de/'),
                '/de': set('/en', '/de', '/fr', '/it'),
                '/fr': set('/fr'),
            }).filter(
                ({ check, page }) =>
                    check === 'sitemap-hreflang' &&
                    page === 'https://acme.com/en',
            ),
        ).toEqual([
            {
                check: 'sitemap-hreflang',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/en',
                detail: { reason: 'self' },
            },
            {
                check: 'sitemap-hreflang',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/de',
                detail: {
                    reason: 'differs',
                    listed: [
                        'https://acme.com/de',
                        'https://acme.com/fr',
                        'https://acme.com/it',
                        'https://acme.de/',
                    ],
                    listedBack: [
                        'https://acme.com/en',
                        'https://acme.com/de',
                        'https://acme.com/fr',
                        'https://acme.com/it',
                    ],
                },
            },
            {
                check: 'sitemap-hreflang',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/fr',
                detail: { reason: 'return', notListed: 'https://acme.com/en' },
            },
        ]);
    });

    it('reports a missing return link from an alternate the queue holds with no sitemap alternates', () => {
        expect(
            siteFindings([row('/en'), row('/it')], {
                '/en': set('/en', '/it'),
                '/it': [],
            }).filter(({ check }) => check === 'sitemap-hreflang'),
        ).toEqual([
            {
                check: 'sitemap-hreflang',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/it',
                detail: { reason: 'return', notListed: 'https://acme.com/en' },
            },
        ]);
    });

    it('reads the return link of an alternate from its tags or its sitemap entry, whichever lists it', () => {
        const findings = (back: Alternate[]) =>
            siteFindings(
                [row('/en', { hreflang: set('/en', '/de') }), row('/de')],
                { '/de': back },
            ).filter(({ check }) => check === 'hreflang-return');

        expect(findings(set('/en', '/de'))).toEqual([]);

        expect(findings(set('/de'))).toEqual([
            {
                check: 'hreflang-return',
                page: 'https://acme.com/en',
                subject: 'https://acme.com/de',
                detail: { reason: 'return', notListed: 'https://acme.com/en' },
            },
        ]);
    });

    it('checks only the indexable pages', () => {
        expect(
            siteFindings([
                row('/en', { is_indexable: false, hreflang: set('/de') }),
            ]),
        ).toEqual([]);
    });
});

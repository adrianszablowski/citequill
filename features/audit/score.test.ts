import { describe, expect, it } from 'vitest';

import type { CheckId } from '@/features/audit/catalogue';
import {
    appliesTo,
    auditScore,
    band,
    cdnTestChecks,
    checksInScope,
    checksRun,
    crossPageChecks,
    gateCap,
    gates,
    hasMark,
    isSelfCanonical,
    isSiteCheck,
    type Mark,
    offersSelectorMark,
    probeChecks,
    scoreAudit,
    type ScoredFinding,
    type ScoredPage,
    resourceChecks,
    shippedChecks,
} from '@/features/audit/score';

const home = 'https://acme.com/';

function page(index: number, overrides: Partial<ScoredPage> = {}): ScoredPage {
    return {
        id: `page-${index}`,
        url: index === 0 ? home : `https://acme.com/p${index}`,
        status_code: 200,
        redirect_to: null,
        is_indexable: true,
        is_blocked: false,
        canonical_url: null,
        in_sitemap: true,
        image_count: 0,
        external_link_count: 0,
        hreflang_count: 0,
        jsonld_count: 0,
        is_article: false,
        ...overrides,
    };
}

function pages(count: number) {
    return Array.from({ length: count }, (_, index) => page(index));
}

let next = 0;

function finding(
    check: CheckId,
    sitePageId: string | null,
    overrides: Partial<ScoredFinding> = {},
): ScoredFinding {
    next += 1;

    return {
        id: `finding-${next}`,
        check,
        severity: check === 'thin-page' ? 'hint' : '3',
        site_page_id: sitePageId,
        subject: null,
        selector: null,
        ...overrides,
    };
}

function score(
    checks: CheckId[],
    sitePages: ScoredPage[],
    findings: ScoredFinding[],
    marks: Mark[] = [],
) {
    return scoreAudit({
        checks,
        pages: sitePages,
        findings,
        marks,
        homes: [home],
    });
}

describe('scoreAudit', () => {
    it('gives 100 to an audit with no failures, and counts the checks that had data', () => {
        const result = score(
            ['page-4xx', 'robots-5xx', 'canonical-to-error'],
            pages(4),
            [],
        );

        expect(result).toMatchObject({
            score: 100,
            is_gated: false,
            checks_scored: 2,
            checks_total: 112,
            severity_3: 0,
            intended: [],
            results: [
                {
                    check: 'page-4xx',
                    pages_checked: 4,
                    pages_failed: 0,
                    pages_intended: 0,
                },
                {
                    check: 'robots-5xx',
                    pages_checked: 1,
                    pages_failed: 0,
                    pages_intended: 0,
                },
            ],
        });
    });

    it('scores an audit that read no page from its site-level checks alone', () => {
        const result = score(
            ['page-4xx', 'page-5xx', 'robots-5xx'],
            [],
            [finding('robots-5xx', null, { subject: `${home}robots.txt` })],
        );

        expect(result).toMatchObject({
            score: 100 - 35,
            is_gated: false,
            checks_scored: 1,
            results: [
                {
                    check: 'robots-5xx',
                    pages_checked: 1,
                    pages_failed: 1,
                    pages_intended: 0,
                },
            ],
        });
    });

    it('costs a severity 3 check its area weight times the failing share, a page once however many findings it has', () => {
        const result = score(['page-4xx'], pages(4), [
            finding('page-4xx', 'page-1'),
            finding('page-4xx', 'page-1'),
        ]);

        expect(result.results).toEqual([
            {
                check: 'page-4xx',
                pages_checked: 4,
                pages_failed: 1,
                pages_intended: 0,
            },
        ]);

        expect(result.score).toBe(Math.round(100 - 35 * 0.25));
        expect(result.severity_3).toBe(2);
    });

    it('scales by severity over 3 and caps an area at its weight', () => {
        expect(
            auditScore([
                {
                    check: 'html-over-2mb',
                    pages_checked: 3,
                    pages_failed: 3,
                    pages_intended: 0,
                },
            ]),
        ).toBe(Math.round(100 - (35 * 2) / 3));

        expect(
            auditScore([
                {
                    check: 'page-4xx',
                    pages_checked: 2,
                    pages_failed: 2,
                    pages_intended: 0,
                },
                {
                    check: 'robots-5xx',
                    pages_checked: 1,
                    pages_failed: 1,
                    pages_intended: 0,
                },
            ]),
        ).toBe(65);
    });

    it('leaves hints and questions out of the score and counts them apart', () => {
        const result = score(['thin-page'], pages(2), [
            finding('thin-page', 'page-1'),
        ]);

        expect(result.score).toBe(100);
        expect(result.checks_scored).toBe(0);
        expect(result.hints).toBe(1);
    });

    it('counts a finding on a page outside the pages its check applies to as no failure', () => {
        const sitePages = [page(0), page(1, { is_indexable: false })];

        const result = score(['html-over-2mb'], sitePages, [
            finding('html-over-2mb', 'page-1'),
        ]);

        expect(result.results).toEqual([
            {
                check: 'html-over-2mb',
                pages_checked: 1,
                pages_failed: 0,
                pages_intended: 0,
            },
        ]);
    });

    it('counts an article check on a page that is no article, and geo-slug on a home page, as no failure', () => {
        const sitePages = [page(0), page(1, { is_article: true }), page(2)];

        const result = score(['one-topic', 'geo-slug'], sitePages, [
            finding('one-topic', 'page-1'),
            finding('one-topic', 'page-2'),
            finding('geo-slug', 'page-0'),
            finding('geo-slug', 'page-2'),
        ]);

        expect(result.results).toEqual([
            {
                check: 'one-topic',
                pages_checked: 1,
                pages_failed: 1,
                pages_intended: 0,
            },
            {
                check: 'geo-slug',
                pages_checked: 2,
                pages_failed: 1,
                pages_intended: 0,
            },
        ]);
    });

    it('ignores the findings of a check that did not run', () => {
        const result = score(['page-4xx'], pages(2), [
            finding('canonical-to-error', 'page-1'),
        ]);

        expect(result.score).toBe(100);
        expect(result.severity_3).toBe(0);
    });

    it('counts a page whose every failing finding is intended as a pass, by URL, by selector or by check', () => {
        const sitePages = pages(4);

        const findings = [
            finding('page-4xx', 'page-1'),
            finding('page-4xx', 'page-2', { selector: 'img.logo' }),
            finding('page-4xx', 'page-2'),
        ];

        const byUrl = score(['page-4xx'], sitePages, findings, [
            { check: 'page-4xx', url: 'https://acme.com/p1', selector: null },
        ]);

        expect(byUrl.results[0]).toMatchObject({
            pages_failed: 2,
            pages_intended: 1,
        });

        expect(byUrl.intended).toEqual([findings[0].id]);
        expect(byUrl.severity_3).toBe(2);

        const bySelector = score(['page-4xx'], sitePages, findings, [
            { check: 'page-4xx', url: null, selector: 'img.logo' },
        ]);

        expect(bySelector.results[0].pages_intended).toBe(0);
        expect(bySelector.intended).toEqual([findings[1].id]);

        const byCheck = score(['page-4xx'], sitePages, findings, [
            { check: 'page-4xx', url: null, selector: null },
        ]);

        expect(byCheck.score).toBe(100);
        expect(byCheck.results[0].pages_intended).toBe(2);
        expect(byCheck.severity_3).toBe(0);

        const otherCheck = score(['page-4xx'], sitePages, findings, [
            { check: 'page-5xx', url: null, selector: null },
        ]);

        expect(otherCheck.intended).toEqual([]);
    });

    it('caps the score at 49 when a gate check fails on the home page', () => {
        const result = score(['page-5xx'], pages(20), [
            finding('page-5xx', 'page-0'),
        ]);

        expect(result.is_gated).toBe(true);
        expect(result.score).toBe(gateCap);
    });

    it('caps the score when a gate check fails on more than 10% of its pages, and not at 10%', () => {
        const gated = score(
            ['page-5xx'],
            pages(20),
            [1, 2, 3].map((index) => finding('page-5xx', `page-${index}`)),
        );

        expect(gated.is_gated).toBe(true);

        const atTen = score(
            ['page-5xx'],
            pages(20),
            [1, 2].map((index) => finding('page-5xx', `page-${index}`)),
        );

        expect(atTen.is_gated).toBe(false);
        expect(atTen.score).toBe(Math.round(100 - 35 * 0.1));
    });

    it("leaves the owner's own noindex pages out of the gate's share", () => {
        const sitePages = [
            ...pages(2),
            ...Array.from({ length: 8 }, (_, index) =>
                page(index + 2, { is_indexable: false }),
            ),
        ];

        const result = score(['page-5xx'], sitePages, [
            finding('page-5xx', 'page-1'),
        ]);

        expect(result.is_gated).toBe(true);
    });

    it('caps the score for a failing site-level gate, and an intended mark lifts it', () => {
        const blocked = finding('robots-googlebot-blocked', null, {
            subject: home,
        });

        expect(
            score(['robots-googlebot-blocked'], pages(2), [blocked]).is_gated,
        ).toBe(true);

        const marked = score(
            ['robots-googlebot-blocked'],
            pages(2),
            [blocked],
            [{ check: 'robots-googlebot-blocked', url: home, selector: null }],
        );

        expect(marked.is_gated).toBe(false);
        expect(marked.score).toBe(100);
    });

    it('caps the score for a finding of a page-scoped gate check with no page, which counts no failing page, and a mark on its subject lifts it', () => {
        const base = 'https://acme.com';
        const missing = finding('soft-404', null, { subject: base });
        const result = score(['soft-404'], pages(20), [missing]);

        expect(result.is_gated).toBe(true);
        expect(result.score).toBe(gateCap);

        expect(result.results).toEqual([
            {
                check: 'soft-404',
                pages_checked: 20,
                pages_failed: 0,
                pages_intended: 0,
            },
        ]);

        expect(appliesTo('soft-404', pages(2), [home])).toHaveLength(2);

        const marked = score(
            ['soft-404'],
            pages(20),
            [missing],
            [{ check: 'soft-404', url: base, selector: null }],
        );

        expect(marked.is_gated).toBe(false);
        expect(marked.intended).toEqual([missing.id]);
    });

    it('checks host-variants on the probed sample alone, so its share counts the pages that were probed', () => {
        const result = score(['host-variants'], pages(100), [
            finding('host-variants', 'page-1', { severity: '2' }),
        ]);

        expect(result.results).toEqual([
            {
                check: 'host-variants',
                pages_checked: 11,
                pages_failed: 1,
                pages_intended: 0,
            },
        ]);
    });

    const gatesOnTwin = (sitePageId: string) => {
        const twin = {
            ...finding('https-missing', sitePageId, {
                subject: 'http://acme.com/',
            }),
            detail: { reason: 'no-redirect' },
        };

        return gates(['https-missing'], pages(30), [twin], new Set(), [home]);
    };

    it('caps the score for https-missing from the http twin of the home page', () => {
        expect(gatesOnTwin('page-0')).toBe(true);
    });

    it('caps nothing for https-missing from the http twin of one page of 30 read', () => {
        expect(gatesOnTwin('page-1')).toBe(false);
    });

    it('caps nothing for a recommendation, however common its failure', () => {
        const result = score(
            ['html-over-2mb'],
            pages(4),
            [0, 1, 2, 3].map((index) =>
                finding('html-over-2mb', `page-${index}`, { severity: '2' }),
            ),
        );

        expect(result.is_gated).toBe(false);
        expect(result.score).toBe(Math.round(100 - (35 * 2) / 3));
    });
});

describe('checksRun', () => {
    it('leaves out the checks that compare pages when an audit was stopped, and noindex-blocked while robots.txt is obeyed', () => {
        const stopped = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: true,
            obeyRobots: false,
            hasPassedCdnTest: false,
        });

        expect(stopped).toContain('page-4xx');
        expect(stopped).toContain('noindex-blocked');

        expect(crossPageChecks.some((check) => stopped.includes(check))).toBe(
            false,
        );

        const complete = checksRun({
            hasCrossPageChecks: true,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        expect(complete).toEqual(expect.arrayContaining([...crossPageChecks]));
        expect(complete).not.toContain('noindex-blocked');
        expect(complete).not.toContain('shell');
    });

    it('leaves out the probe checks when an audit was stopped, and keeps soft-404, whose phrase half runs in Read', () => {
        const stopped = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        expect(probeChecks.some((check) => stopped.includes(check))).toBe(
            false,
        );

        expect(stopped).toContain('soft-404');

        const complete = checksRun({
            hasCrossPageChecks: true,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: true,
        });

        expect(complete).toEqual(
            expect.arrayContaining([...probeChecks, 'soft-404']),
        );
    });

    it('runs ai-cdn-blocked and pay-per-crawl only when the CDN test passed, and markdown-alternate with the other probes', () => {
        const run = (hasPassedCdnTest: boolean) =>
            checksRun({
                hasCrossPageChecks: true,
                hasDiscovered: true,
                obeyRobots: true,
                hasPassedCdnTest,
            });

        expect(run(true)).toEqual(
            expect.arrayContaining(['ai-cdn-blocked', 'pay-per-crawl']),
        );

        for (const check of cdnTestChecks) {
            expect(run(false)).not.toContain(check);
        }

        expect(run(false)).toContain('markdown-alternate');

        const stopped = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: true,
        });

        for (const check of [
            'ai-cdn-blocked',
            'pay-per-crawl',
            'markdown-alternate',
        ] as const) {
            expect(probeChecks).toContain(check);
            expect(stopped).not.toContain(check);
        }
    });

    it('leaves a site check that did not run out of the results and of the checks scored', () => {
        const run = (hasPassedCdnTest: boolean) =>
            score(
                checksRun({
                    hasCrossPageChecks: true,
                    hasDiscovered: true,
                    obeyRobots: true,
                    hasPassedCdnTest,
                }),
                pages(2),
                [finding('ai-cdn-blocked', null, { severity: '2' })],
            );

        const passed = run(true);
        const refused = run(false);

        expect(passed.results).toContainEqual({
            check: 'ai-cdn-blocked',
            pages_checked: 1,
            pages_failed: 1,
            pages_intended: 0,
        });

        expect(refused.results.map(({ check }) => check)).not.toContain(
            'ai-cdn-blocked',
        );

        expect(refused.checks_scored).toBe(passed.checks_scored - 1);
        expect(refused.severity_2).toBe(0);
    });

    it('leaves out the robots and sitemap checks when the audit stopped before Discover wrote the robots rules', () => {
        const undiscovered = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: false,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        expect(undiscovered).toContain('page-4xx');
        expect(undiscovered).not.toContain('robots-5xx');
        expect(undiscovered).not.toContain('sitemap-missing');
    });
});

describe('appliesTo', () => {
    it('applies the pages-not-in-sitemap check to no page when the site lists none', () => {
        expect(
            appliesTo(
                'page-not-in-sitemap',
                [page(1, { in_sitemap: false })],
                [home],
            ),
        ).toEqual([]);

        expect(
            appliesTo(
                'page-not-in-sitemap',
                [
                    page(1, { in_sitemap: false }),
                    page(2, { canonical_url: 'https://acme.com/p1' }),
                    page(3, { canonical_url: 'https://acme.com/p3' }),
                ],
                [home],
            ).map(({ id }) => id),
        ).toEqual(['page-1', 'page-3']);
    });

    it('applies the hreflang checks to the indexable pages with alternates', () => {
        expect(
            appliesTo(
                'hreflang-return',
                [
                    page(1, { hreflang_count: 2 }),
                    page(2),
                    page(3, { hreflang_count: 2, is_indexable: false }),
                ],
                [home],
            ).map(({ id }) => id),
        ).toEqual(['page-1']);
    });

    it('applies the structured data checks to the indexable pages with a JSON-LD block, parsed or not, and structured-data-format to every indexable page', () => {
        const sitePages = [
            page(1, { jsonld_count: 1 }),
            page(2),
            page(3, { jsonld_count: 2, is_indexable: false }),
        ];

        for (const check of [
            'jsonld-invalid',
            'jsonld-image-unreachable',
        ] as const) {
            expect(
                appliesTo(check, sitePages, [home]).map(({ id }) => id),
            ).toEqual(['page-1']);
        }

        expect(
            appliesTo('structured-data-format', sitePages, [home]).map(
                ({ id }) => id,
            ),
        ).toEqual(['page-1', 'page-2']);
    });

    it('applies a redirect check to the URLs that redirected and page-5xx to every URL read', () => {
        const sitePages = [
            page(0),
            page(1, {
                status_code: 301,
                redirect_to: 'https://acme.com/new',
                is_indexable: false,
            }),
            page(2, {
                status_code: null,
                is_indexable: false,
                is_blocked: true,
            }),
        ];

        expect(
            appliesTo('redirect-chain', sitePages, [home]).map(({ id }) => id),
        ).toEqual(['page-1']);

        expect(
            appliesTo('page-5xx', sitePages, [home]).map(({ id }) => id),
        ).toEqual(['page-0', 'page-1']);
    });

    it('applies security-headers to the home pages that answered, a noindex home included, and tls-invalid to every URL read', () => {
        const de = 'https://acme.de/';

        const sitePages = [
            page(0, { is_indexable: false }),
            page(1),
            page(2, {
                url: de,
                status_code: 301,
                redirect_to: 'https://acme.de/en',
            }),
            page(3, { status_code: null, is_indexable: false }),
        ];

        expect(
            appliesTo('security-headers', sitePages, [home, de]).map(
                ({ id }) => id,
            ),
        ).toEqual(['page-0']);

        expect(
            appliesTo('tls-invalid', sitePages, [home]).map(({ id }) => id),
        ).toEqual(['page-0', 'page-1', 'page-2', 'page-3']);
    });

    it('applies the external link checks to the indexable pages with an external link', () => {
        const sitePages = [
            page(0),
            page(1, { external_link_count: 2 }),
            page(2, { external_link_count: 1, is_indexable: false }),
        ];

        for (const check of [
            'link-broken-external',
            'link-external-refused',
        ] as const) {
            expect(
                appliesTo(check, sitePages, [home]).map(({ id }) => id),
            ).toEqual(['page-1']);
        }
    });

    it('applies resource-broken to the indexable pages with images and to the sample, which holds every home', () => {
        const sitePages = [
            page(0),
            page(1, { url: 'https://acme.com/a/b', image_count: 2 }),
            page(2, { url: 'https://acme.com/a/c' }),
            page(3, { image_count: 1, is_indexable: false }),
        ];

        expect(
            appliesTo('resource-broken', sitePages, [home]).map(({ id }) => id),
        ).toEqual(['page-0', 'page-1']);
    });

    it('applies answer-first, one-topic and the two GEO hints of an article to the indexable article pages', () => {
        const sitePages = [
            page(0, { is_article: true }),
            page(1, { is_article: true }),
            page(2),
            page(3, { is_article: true, is_indexable: false }),
        ];

        for (const check of [
            'answer-first',
            'one-topic',
            'geo-qa-structure',
            'geo-source-links',
        ] as const) {
            expect(
                appliesTo(check, sitePages, [home]).map(({ id }) => id),
                check,
            ).toEqual(['page-0', 'page-1']);
        }
    });

    it('applies geo-slug to the indexable pages other than the home pages', () => {
        const de = 'https://acme.com/de/';

        const sitePages = [
            page(0),
            page(1, { url: de }),
            page(2, { is_article: true }),
            page(3),
            page(4, { is_indexable: false }),
        ];

        expect(
            appliesTo('geo-slug', sitePages, [home, de]).map(({ id }) => id),
        ).toEqual(['page-2', 'page-3']);
    });
});

describe('the on-page checks', () => {
    it('apply the image checks to the indexable pages with images, and the rest to the indexable pages', () => {
        const sitePages = [
            page(0, { image_count: 3 }),
            page(1),
            page(2, { image_count: 1, is_indexable: false }),
        ];

        expect(
            appliesTo('img-alt-missing', sitePages, [home]).map(({ id }) => id),
        ).toEqual(['page-0']);

        expect(
            appliesTo('svg-no-role', sitePages, [home]).map(({ id }) => id),
        ).toEqual(['page-0']);

        expect(
            appliesTo('title-missing', sitePages, [home]).map(({ id }) => id),
        ).toEqual(['page-0', 'page-1']);
    });

    it('count as no data for the image checks on a site with no images', () => {
        const result = score(['img-alt-missing', 'h1-missing'], pages(3), []);

        expect(result.results.map(({ check }) => check)).toEqual([
            'h1-missing',
        ]);

        expect(result.checks_scored).toBe(1);
    });

    it('compare pages for the title and description duplicates and the boilerplate title, so a stopped audit skips them', () => {
        const stopped = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        for (const check of [
            'title-duplicate',
            'title-boilerplate',
            'description-duplicate',
        ] as const) {
            expect(crossPageChecks).toContain(check);
            expect(stopped).not.toContain(check);
        }

        expect(stopped).toContain('title-missing');
        expect(stopped).toContain('img-no-dimensions');
    });

    it('leave the deferred, rendered and structured data rows out of the checks that run', () => {
        const complete = checksRun({
            hasCrossPageChecks: true,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        for (const check of [
            'title-language',
            'twitter-card',
            'img-oversized',
            'link-blank-noopener',
            'link-scripted',
            'link-rendered-only',
            'title-rendered-only',
        ] as const) {
            expect(complete).not.toContain(check);
        }
    });
});

describe('band', () => {
    it('is good from 90, needs work from 50 and poor below', () => {
        expect(band(100)).toBe('good');
        expect(band(90)).toBe('good');
        expect(band(89)).toBe('needs-work');
        expect(band(50)).toBe('needs-work');
        expect(band(49)).toBe('poor');
        expect(band(0)).toBe('poor');
    });
});

describe('hasMark', () => {
    const marks: Mark[] = [
        { check: 'page-4xx', url: 'https://acme.com/a', selector: null },
        { check: 'page-4xx', url: null, selector: null },
    ];

    it('finds a mark only at its own grain', () => {
        expect(
            hasMark(marks, { check: 'page-4xx', url: null, selector: null }),
        ).toBe(true);

        expect(
            hasMark(marks, {
                check: 'page-4xx',
                url: 'https://acme.com/b',
                selector: null,
            }),
        ).toBe(false);

        expect(
            hasMark(marks, { check: 'page-4xx', url: null, selector: 'img' }),
        ).toBe(false);
    });

    it('finds nothing among no marks', () => {
        expect(
            hasMark([], { check: 'page-4xx', url: null, selector: null }),
        ).toBe(false);
    });
});

describe('offersSelectorMark', () => {
    const onTag = {
        check: 'anchor-generic' as const,
        url: null,
        selector: 'a',
    };

    it('offers the selector grain for a selector with an id or a class', () => {
        expect(offersSelectorMark([], { ...onTag, selector: 'a.logo' })).toBe(
            true,
        );
    });

    it('withholds the selector grain from a bare tag with no mark', () => {
        expect(offersSelectorMark([], onTag)).toBe(false);
    });

    it('keeps the selector grain for a bare tag that already has a mark, so the mark can be removed', () => {
        expect(offersSelectorMark([onTag], onTag)).toBe(true);
    });
});

describe('isSiteCheck', () => {
    it('tells a check on the site from a check on its pages', () => {
        expect(isSiteCheck('sitemap-missing')).toBe(true);
        expect(isSiteCheck('page-4xx')).toBe(false);
    });
});

describe('checksInScope', () => {
    it('lists the checks of one page scope and no other', () => {
        const images = checksInScope('images');

        expect(images).toEqual(
            expect.arrayContaining(['img-alt-missing', 'svg-no-name']),
        );

        expect(images).not.toContain('title-missing');
        expect(images.some(isSiteCheck)).toBe(false);
    });

    it('lists the checks on the site for the site scope', () => {
        expect(checksInScope('site')).toContain('sitemap-missing');
        expect(checksInScope('site').every(isSiteCheck)).toBe(true);
    });

    it('lists the twelve structured data checks for the jsonld scope, structured-data-format left to the indexable pages', () => {
        expect(checksInScope('jsonld')).toEqual([
            'jsonld-invalid',
            'jsonld-unknown-type',
            'jsonld-dropped-feature',
            'jsonld-required-missing',
            'jsonld-recommended-missing',
            'jsonld-mismatch',
            'jsonld-self-review',
            'jsonld-image-unreachable',
            'jsonld-image-small',
            'jsonld-logo-small',
            'merchant-price-zero',
            'breadcrumb-short',
        ]);

        expect(checksInScope('indexable')).toContain('structured-data-format');
    });

    it('lists the nine hreflang checks for the hreflang scope', () => {
        expect(checksInScope('hreflang')).toEqual([
            'sitemap-hreflang',
            'hreflang-return',
            'hreflang-code',
            'hreflang-target',
            'hreflang-target-canonical',
            'hreflang-http',
            'hreflang-x-default',
            'hreflang-methods',
            'hreflang-on-canonical',
        ]);
    });
});

describe('shippedChecks', () => {
    it('ships 162 checks, the HTTPS, viewport, performance, hreflang and structured data checks, the phone comparison, and the robots.txt, directive, CDN test, markdown, page-shape and GEO checks of AI access included, protocol-relative left out', () => {
        expect(shippedChecks).toHaveLength(162);
    });

    it('judges assets-uncached on the pages of the sample, as the resource step puts it there', () => {
        expect(checksInScope('sampled')).toContain('assets-uncached');
        expect(resourceChecks).toContain('assets-uncached');
    });

    it('scores the probed half of https-missing with its Read half, so a stopped audit keeps the check and skips the phone comparison', () => {
        const stopped = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        expect(stopped).toContain('https-missing');
        expect(stopped).toContain('tls-invalid');
        expect(stopped).not.toContain('mobile-content-differs');
    });

    it('leaves the resource and cross-page link checks out of a stopped audit, and keeps the Read half of og-image-bad', () => {
        const stopped = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        for (const check of [...resourceChecks, 'orphan', 'link-to-redirect']) {
            expect(stopped).not.toContain(check);
        }

        expect(stopped).toContain('og-image-bad');
        expect(stopped).not.toContain('jsonld-image-unreachable');
        expect(stopped).toContain('jsonld-invalid');
        expect(stopped).toContain('anchor-generic');
    });

    it('compares pages for near-duplicate, so a stopped audit skips it, and scores the two-half checks from their Read half', () => {
        const stopped = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: true,
            obeyRobots: true,
            hasPassedCdnTest: false,
        });

        expect(stopped).not.toContain('near-duplicate');
        expect(stopped).toContain('param-duplicates');
        expect(stopped).toContain('facets-indexable');
        expect(stopped).toContain('assets-heavy');
    });
});

describe('isSelfCanonical', () => {
    it('is an indexable page with no canonical or one naming itself', () => {
        const url = 'https://acme.com/a';

        expect(
            isSelfCanonical({ url, canonical_url: null, is_indexable: true }),
        ).toBe(true);

        expect(
            isSelfCanonical({ url, canonical_url: url, is_indexable: true }),
        ).toBe(true);

        expect(
            isSelfCanonical({
                url,
                canonical_url: 'https://acme.com/b',
                is_indexable: true,
            }),
        ).toBe(false);

        expect(
            isSelfCanonical({ url, canonical_url: null, is_indexable: false }),
        ).toBe(false);
    });
});

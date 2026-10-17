import { describe, expect, it } from 'vitest';

import type { CheckId } from '@/features/audit/catalogue';
import {
    appliesTo,
    auditScore,
    band,
    checksRun,
    crossPageChecks,
    gateCap,
    type Mark,
    scoreAudit,
    type ScoredFinding,
    type ScoredPage,
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
            checks_total: 116,
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
        });

        expect(complete).toEqual(expect.arrayContaining([...crossPageChecks]));
        expect(complete).not.toContain('noindex-blocked');
        expect(complete).not.toContain('soft-404');
    });

    it('leaves out the robots and sitemap checks when the audit stopped before Discover wrote the robots rules', () => {
        const undiscovered = checksRun({
            hasCrossPageChecks: false,
            hasDiscovered: false,
            obeyRobots: true,
        });

        expect(undiscovered).toContain('page-4xx');
        expect(undiscovered).not.toContain('robots-5xx');
        expect(undiscovered).not.toContain('sitemap-missing');
    });
});

describe('appliesTo', () => {
    it('applies the pages-not-in-sitemap check to no page when the site lists none', () => {
        expect(
            appliesTo('page-not-in-sitemap', [page(1, { in_sitemap: false })]),
        ).toEqual([]);

        expect(
            appliesTo('page-not-in-sitemap', [
                page(1, { in_sitemap: false }),
                page(2, { canonical_url: 'https://acme.com/p1' }),
                page(3, { canonical_url: 'https://acme.com/p3' }),
            ]).map(({ id }) => id),
        ).toEqual(['page-1', 'page-3']);
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
            appliesTo('redirect-chain', sitePages).map(({ id }) => id),
        ).toEqual(['page-1']);

        expect(appliesTo('page-5xx', sitePages).map(({ id }) => id)).toEqual([
            'page-0',
            'page-1',
        ]);
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

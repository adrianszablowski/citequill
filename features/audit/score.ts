import {
    areaWeights,
    type CheckId,
    checkOf,
    isScored,
    scoredChecks,
} from '@/features/audit/catalogue';
import type { Tables, TablesInsert } from '@/lib/types/database';

export type ScoredPage = Pick<
    Tables<'site_pages'>,
    | 'id'
    | 'url'
    | 'status_code'
    | 'redirect_to'
    | 'is_indexable'
    | 'is_blocked'
    | 'canonical_url'
    | 'in_sitemap'
    | 'image_count'
>;

export const scoredPageColumns =
    'id, url, status_code, redirect_to, is_indexable, is_blocked, canonical_url, in_sitemap, image_count';

export type ScoredFinding = Pick<
    Tables<'audit_findings'>,
    'id' | 'check' | 'severity' | 'site_page_id' | 'subject' | 'selector'
>;

export type Mark = Pick<Tables<'audit_marks'>, 'check' | 'url' | 'selector'>;

export type CheckResult = Pick<
    Tables<'audit_check_results'>,
    'check' | 'pages_checked' | 'pages_failed' | 'pages_intended'
>;

export type Band = 'good' | 'needs-work' | 'poor';

export interface Audited {
    checks: readonly CheckId[];
    pages: ScoredPage[];
    findings: ScoredFinding[];
    marks: Mark[];
    homes: string[];
}

export const gateCap = 49;

export const gateShare = 0.1;

export const crossPageChecks = [
    'noindex-site',
    'canonical-to-error',
    'canonical-chain',
    'canonical-cross-domain',
    'duplicate-body',
    'near-duplicate',
    'page-not-in-sitemap',
    'sitemap-url-error',
    'sitemap-url-noncanonical',
    'title-duplicate',
    'title-boilerplate',
    'description-duplicate',
] as const satisfies readonly CheckId[];

export function scoreAudit({ checks, pages, findings, marks, homes }: Audited) {
    const ran = new Set<string>(checks);
    const counted = findings.filter((finding) => ran.has(finding.check));
    const intended = intendedFindings(counted, marks, pages);
    const results = checkResults(checks, pages, counted, intended);
    const isGated = gates(checks, pages, counted, intended, homes);
    const score = auditScore(results);

    return {
        score: isGated ? Math.min(score, gateCap) : score,
        is_gated: isGated,
        checks_scored: results.filter((result) =>
            isScored(checkOf(result.check as CheckId).severity),
        ).length,
        checks_total: scoredChecks.length,
        ...counters(counted, intended),
        intended: [...intended],
        results,
    };
}

export function checksRun({
    hasCrossPageChecks,
    hasDiscovered,
    obeyRobots,
}: {
    hasCrossPageChecks: boolean;
    hasDiscovered: boolean;
    obeyRobots: boolean;
}) {
    const skipped = new Set<CheckId>([
        ...(hasCrossPageChecks ? [] : crossPageChecks),
        ...(obeyRobots ? ['noindex-blocked' as const] : []),
    ]);

    return shippedChecks.filter(
        (check) =>
            !skipped.has(check) && (hasDiscovered || scopes[check] !== 'site'),
    );
}

export function hasMark(marks: Mark[], mark: Mark) {
    return marks.some(
        (other) =>
            other.check === mark.check &&
            other.url === mark.url &&
            other.selector === mark.selector,
    );
}

export function appliesTo(check: CheckId, pages: ScoredPage[]) {
    const scope = scopes[check];

    return scope && scope !== 'site' ? pageScopes[scope](pages) : [];
}

export function intendedFindings(
    findings: ScoredFinding[],
    marks: Mark[],
    pages: ScoredPage[],
) {
    const urls = new Map(pages.map((page) => [page.id, page.url]));

    return new Set(
        findings
            .filter((finding) =>
                marks.some((mark) => {
                    const url = finding.site_page_id
                        ? urls.get(finding.site_page_id)
                        : finding.subject;

                    return (
                        mark.check === finding.check &&
                        (mark.url === null || mark.url === url) &&
                        (mark.selector === null ||
                            mark.selector === finding.selector)
                    );
                }),
            )
            .map((finding) => finding.id),
    );
}

export function checkResults(
    checks: readonly CheckId[],
    pages: ScoredPage[],
    findings: ScoredFinding[],
    intended: ReadonlySet<string>,
): CheckResult[] {
    return checks.flatMap((check) => {
        const failing = failingPages(check, pages, findings);

        const pagesChecked =
            scopes[check] === 'site' ? 1 : appliesTo(check, pages).length;

        return pagesChecked > 0
            ? [
                  {
                      check,
                      pages_checked: pagesChecked,
                      pages_failed: failing.size,
                      pages_intended: [...failing.values()].filter((ids) =>
                          ids.every((id) => intended.has(id)),
                      ).length,
                  },
              ]
            : [];
    });
}

export function auditScore(results: CheckResult[]) {
    const penalties = new Map<keyof typeof areaWeights, number>();

    for (const result of results) {
        const { area, severity } = checkOf(result.check as CheckId);

        if (!isScored(severity)) {
            continue;
        }

        const share =
            (result.pages_failed - result.pages_intended) /
            result.pages_checked;

        penalties.set(
            area,
            (penalties.get(area) ?? 0) +
                (areaWeights[area] * share * Number(severity)) / 3,
        );
    }

    return Math.round(
        100 -
            [...penalties].reduce(
                (sum, [area, penalty]) =>
                    sum + Math.min(areaWeights[area], penalty),
                0,
            ),
    );
}

export function gates(
    checks: readonly CheckId[],
    pages: ScoredPage[],
    findings: ScoredFinding[],
    intended: ReadonlySet<string>,
    homes: string[],
) {
    const open = findings.filter((finding) => !intended.has(finding.id));

    return checks
        .filter((check) => checkOf(check).isGate)
        .some((check) => {
            if (scopes[check] === 'site') {
                return open.some((finding) => finding.check === check);
            }

            const failing = failingPages(check, pages, open);
            const applies = appliesTo(check, pages);
            const failed = applies.filter((page) => failing.has(page.id));

            if (failed.some((page) => homes.includes(page.url))) {
                return true;
            }

            const counted = applies.filter((page) => !isNoindexed(page));

            return (
                counted.length > 0 &&
                failed.filter((page) => !isNoindexed(page)).length /
                    counted.length >
                    gateShare
            );
        });
}

export function band(score: number): Band {
    if (score >= 90) {
        return 'good';
    }

    return score >= 50 ? 'needs-work' : 'poor';
}

export function isAnswered(page: ScoredPage) {
    return page.status_code === 200 && page.redirect_to === null;
}

export function isSelfCanonical(
    page: Pick<
        TablesInsert<'site_pages'>,
        'url' | 'canonical_url' | 'is_indexable'
    >,
) {
    return (
        page.is_indexable === true &&
        (!page.canonical_url || page.canonical_url === page.url)
    );
}

export function isNoindexed(page: ScoredPage) {
    return isAnswered(page) && !page.is_indexable && !page.is_blocked;
}

type PageScope = keyof typeof pageScopes;

const pageScopes = {
    indexable: (pages: ScoredPage[]) =>
        pages.filter((page) => page.is_indexable),
    read: (pages: ScoredPage[]) => pages.filter((page) => !page.is_blocked),
    answered: (pages: ScoredPage[]) => pages.filter(isAnswered),
    redirected: (pages: ScoredPage[]) =>
        pages.filter((page) => page.redirect_to !== null),
    canonical: (pages: ScoredPage[]) =>
        pages.filter((page) => page.canonical_url !== null),
    listed: (pages: ScoredPage[]) => pages.filter((page) => page.in_sitemap),
    images: (pages: ScoredPage[]) =>
        pages.filter((page) => page.is_indexable && page.image_count > 0),
    'self-canonical': (pages: ScoredPage[]) =>
        pages.some((page) => page.in_sitemap)
            ? pages.filter(isSelfCanonical)
            : [],
};

const scopes: Partial<Record<CheckId, PageScope | 'site'>> = {
    'noindex-site': 'site',
    'robots-5xx': 'site',
    'robots-googlebot-blocked': 'site',
    'robots-size': 'site',
    'robots-unsupported': 'site',
    'robots-4xx': 'site',
    'sitemap-missing': 'site',
    'sitemap-unreachable': 'site',
    'sitemap-not-in-robots': 'site',
    'sitemap-limits': 'site',
    'sitemap-invalid': 'site',
    'sitemap-scope': 'site',
    'sitemap-lastmod': 'site',
    'sitemap-priority': 'site',
    'sitemap-extensions': 'site',
    'noindex-blocked': 'answered',
    'noindex-content': 'answered',
    'robots-conflict': 'answered',
    'robots-invalid': 'answered',
    'robots-none': 'answered',
    'unavailable-after-past': 'indexable',
    'html-over-2mb': 'indexable',
    'robots-assets-blocked': 'indexable',
    'search-results-indexable': 'indexable',
    'facets-indexable': 'indexable',
    'pagination-canonical': 'answered',
    'utility-indexable': 'indexable',
    'page-4xx': 'read',
    'page-5xx': 'read',
    'redirect-chain': 'redirected',
    'redirect-chain-long': 'redirected',
    'redirect-loop': 'redirected',
    'redirect-to-error': 'redirected',
    'redirect-meta': 'indexable',
    'redirect-slash-or-case': 'redirected',
    'redirect-temporary': 'redirected',
    'canonical-missing': 'indexable',
    'canonical-outside-head': 'canonical',
    'canonical-relative': 'canonical',
    'canonical-conflict': 'canonical',
    'canonical-language': 'canonical',
    'canonical-to-error': 'canonical',
    'canonical-chain': 'canonical',
    'canonical-cross-domain': 'canonical',
    'param-duplicates': 'indexable',
    'duplicate-body': 'indexable',
    'near-duplicate': 'indexable',
    'spam-pattern': 'answered',
    'page-not-in-sitemap': 'self-canonical',
    'sitemap-url-error': 'listed',
    'sitemap-url-noncanonical': 'listed',
    'html-lang': 'indexable',
    'thin-page': 'indexable',
    'title-missing': 'indexable',
    'title-duplicate': 'indexable',
    'title-boilerplate': 'indexable',
    'title-stuffed': 'indexable',
    'title-width': 'indexable',
    'description-missing': 'indexable',
    'description-duplicate': 'indexable',
    'description-length': 'indexable',
    'h1-missing': 'indexable',
    'h1-count': 'indexable',
    'heading-order': 'indexable',
    'head-invalid': 'indexable',
    'lorem-ipsum': 'indexable',
    plugins: 'indexable',
    'text-ratio': 'indexable',
    'content-stale': 'indexable',
    'url-shape': 'indexable',
    'og-missing': 'indexable',
    'img-alt-missing': 'images',
    'img-alt-whitespace': 'images',
    'img-generator-blank': 'images',
    'img-decorative-focusable': 'images',
    'img-decorative-title': 'images',
    'img-title-only': 'images',
    'img-figure-no-alt': 'images',
    'img-alt-redundant': 'images',
    'img-alt-filename': 'images',
    'img-alt-long': 'images',
    'img-alt-stuffed': 'images',
    'svg-no-name': 'images',
    'svg-no-role': 'images',
    'icon-no-name': 'images',
    'picture-no-src': 'images',
    'img-no-dimensions': 'images',
    'img-filename-generic': 'images',
};

export const shippedChecks = Object.keys(scopes) as CheckId[];

export function checksInScope(scope: PageScope | 'site') {
    return shippedChecks.filter((check) => scopes[check] === scope);
}

export function isSiteCheck(check: CheckId) {
    return scopes[check] === 'site';
}

function failingPages(
    check: CheckId,
    pages: ScoredPage[],
    findings: ScoredFinding[],
) {
    const inScope = new Set(appliesTo(check, pages).map((page) => page.id));
    const failing = new Map<string, string[]>();

    for (const finding of findings) {
        const page = scopes[check] === 'site' ? 'site' : finding.site_page_id;

        if (finding.check !== check || page === null) {
            continue;
        }

        if (page === 'site' || inScope.has(page)) {
            failing.set(page, [...(failing.get(page) ?? []), finding.id]);
        }
    }

    return failing;
}

function counters(findings: ScoredFinding[], intended: ReadonlySet<string>) {
    const open = findings.filter((finding) => !intended.has(finding.id));

    const count = (severity: string) =>
        open.filter((finding) => finding.severity === severity).length;

    return {
        severity_3: count('3'),
        severity_2: count('2'),
        severity_1: count('1'),
        hints: count('hint'),
        questions: count('question'),
    };
}

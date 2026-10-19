export type Severity = '3' | '2' | '1' | 'hint' | 'question';

export type Need = 'raw' | 'rendered' | 'sample' | 'slice-6';

export type Area = keyof typeof areaWeights;

export type CheckId = (typeof rows)[Area][number][0];

export interface Check {
    id: CheckId;
    area: Area;
    severity: Severity;
    isGate: boolean;
    needs: Need;
}

export const areaWeights = {
    indexability: 35,
    'on-page': 15,
    links: 15,
    https: 10,
    mobile: 5,
    performance: 10,
    'ai-access': 10,
} as const;

type Row = readonly [id: string, severity: Severity, mark?: 'gate' | Need];

const rows = {
    indexability: [
        ['robots-5xx', '3'],
        ['robots-googlebot-blocked', '3', 'gate'],
        ['robots-assets-blocked', '2'],
        ['robots-size', '2'],
        ['robots-unsupported', 'hint'],
        ['robots-4xx', 'hint'],
        ['noindex-site', '3', 'gate'],
        ['noindex-content', 'question'],
        ['noindex-blocked', '2'],
        ['robots-conflict', '2'],
        ['robots-invalid', 'hint'],
        ['robots-none', 'hint'],
        ['unavailable-after-past', '2'],
        ['noindex-rendered-only', '2', 'rendered'],
        ['soft-404', '3', 'gate'],
        ['html-over-2mb', '2'],
        ['search-results-indexable', '2'],
        ['facets-indexable', '2'],
        ['pagination-canonical', '2'],
        ['staging-indexable', '2'],
        ['shell', '3'],
        ['thin-page', 'hint'],
        ['utility-indexable', 'hint'],
        ['page-4xx', '3'],
        ['page-5xx', '3', 'gate'],
        ['redirect-chain', '2'],
        ['redirect-chain-long', '3', 'gate'],
        ['redirect-loop', '3', 'gate'],
        ['redirect-to-error', '3'],
        ['redirect-temporary', 'hint'],
        ['redirect-meta', '2'],
        ['redirect-script', '2', 'rendered'],
        ['redirect-to-home', '2'],
        ['redirect-slash-or-case', 'hint'],
        ['canonical-missing', 'hint'],
        ['canonical-outside-head', '2'],
        ['canonical-relative', '2'],
        ['canonical-conflict', '3'],
        ['canonical-rendered-only', '2', 'rendered'],
        ['canonical-to-error', '3'],
        ['canonical-chain', '2'],
        ['canonical-cross-domain', 'question'],
        ['canonical-language', '3'],
        ['host-variants', '2'],
        ['param-duplicates', '2'],
        ['duplicate-body', '2'],
        ['near-duplicate', 'hint'],
        ['markdown-parity', '2'],
        ['spam-pattern', '3', 'gate'],
        ['sitemap-missing', '2'],
        ['sitemap-unreachable', '3'],
        ['sitemap-not-in-robots', 'hint'],
        ['sitemap-limits', '3'],
        ['sitemap-invalid', '3'],
        ['sitemap-scope', '3'],
        ['sitemap-url-error', '3'],
        ['sitemap-url-noncanonical', '2'],
        ['page-not-in-sitemap', '2'],
        ['sitemap-lastmod', '2'],
        ['sitemap-priority', 'hint'],
        ['sitemap-extensions', '2'],
        ['sitemap-hreflang', '3'],
        ['hreflang-return', '3'],
        ['hreflang-code', '3'],
        ['hreflang-target', '3'],
        ['hreflang-target-canonical', '2'],
        ['hreflang-http', '2'],
        ['hreflang-x-default', 'hint'],
        ['hreflang-methods', '2'],
        ['hreflang-on-canonical', 'hint'],
        ['html-lang', 'hint'],
    ],
    'on-page': [
        ['title-missing', '2'],
        ['title-duplicate', '2'],
        ['title-boilerplate', '2'],
        ['title-stuffed', '2'],
        ['title-width', '1'],
        ['title-language', 'hint'],
        ['title-rendered-only', 'hint', 'rendered'],
        ['description-missing', '2'],
        ['description-duplicate', 'hint'],
        ['description-length', 'hint'],
        ['h1-missing', '2'],
        ['h1-count', 'hint'],
        ['heading-order', 'hint'],
        ['head-invalid', '2'],
        ['lorem-ipsum', '2'],
        ['plugins', 'hint'],
        ['text-ratio', 'hint'],
        ['content-stale', 'hint'],
        ['url-shape', 'hint'],
        ['img-alt-missing', '2'],
        ['img-alt-whitespace', '2'],
        ['img-generator-blank', '2'],
        ['img-decorative-focusable', '2'],
        ['img-decorative-title', 'hint'],
        ['img-title-only', 'hint'],
        ['img-figure-no-alt', 'hint'],
        ['img-alt-redundant', 'hint'],
        ['img-alt-filename', '2'],
        ['img-alt-long', 'hint'],
        ['img-alt-stuffed', '2'],
        ['svg-no-name', '2'],
        ['svg-no-role', 'hint'],
        ['icon-no-name', '2'],
        ['picture-no-src', '2'],
        ['img-lazy-first-viewport', '2', 'rendered'],
        ['img-lazy-scripted', '2', 'rendered'],
        ['img-no-dimensions', '2'],
        ['img-heavy', 'hint'],
        ['img-oversized', 'hint', 'rendered'],
        ['img-filename-generic', 'hint'],
        ['jsonld-invalid', '2', 'slice-6'],
        ['jsonld-unknown-type', '2', 'slice-6'],
        ['jsonld-dropped-feature', 'hint', 'slice-6'],
        ['jsonld-required-missing', '2', 'slice-6'],
        ['jsonld-recommended-missing', 'hint', 'slice-6'],
        ['jsonld-mismatch', '3', 'slice-6'],
        ['jsonld-self-review', '3', 'slice-6'],
        ['jsonld-image-unreachable', '2', 'slice-6'],
        ['jsonld-image-small', 'hint', 'slice-6'],
        ['jsonld-logo-small', 'hint', 'slice-6'],
        ['jobposting-expired', '3', 'slice-6'],
        ['merchant-price-zero', '3', 'slice-6'],
        ['breadcrumb-short', '2', 'slice-6'],
        ['structured-data-format', 'hint', 'slice-6'],
        ['og-missing', 'hint'],
        ['og-image-bad', 'hint'],
        ['twitter-card', 'hint'],
    ],
    links: [
        ['link-broken-internal', '3'],
        ['link-broken-external', '2'],
        ['link-external-refused', 'hint'],
        ['resource-broken', '2'],
        ['link-uncrawlable', '3'],
        ['link-scripted', '2', 'rendered'],
        ['link-malformed', '2'],
        ['link-to-redirect', 'hint'],
        ['link-nofollow-internal', 'hint'],
        ['page-no-outlinks', '2'],
        ['orphan', '2'],
        ['link-depth', 'hint'],
        ['link-count', 'hint'],
        ['anchor-generic', '2'],
        ['anchor-empty', '2'],
        ['link-blank-noopener', 'hint'],
        ['link-rendered-only', '2', 'rendered'],
    ],
    https: [
        ['https-missing', '3', 'gate'],
        ['https-to-http', '3'],
        ['tls-invalid', '3'],
        ['mixed-active', '3', 'gate'],
        ['mixed-passive', '2'],
        ['form-on-http', '2'],
        ['content-type-wrong', '2'],
        ['protocol-relative', 'hint'],
        ['security-headers', 'hint'],
    ],
    mobile: [
        ['viewport-missing', '3'],
        ['viewport-misconfigured', '2'],
        ['mobile-content-differs', '2', 'sample'],
        ['interstitial', '2', 'rendered'],
        ['mobile-layout', 'hint', 'rendered'],
    ],
    performance: [
        ['html-slow', '2'],
        ['html-uncompressed', '2'],
        ['assets-uncached', 'hint'],
        ['assets-heavy', 'hint'],
        ['dom-size', 'hint'],
    ],
    'ai-access': [
        ['ai-search-bots-blocked', '2'],
        ['ai-cdn-blocked', '2'],
        ['nosnippet', '2'],
        ['max-snippet-small', '1'],
        ['noarchive', '2'],
        ['nocache', '1'],
        ['answer-first', '1'],
        ['one-topic', '1'],
    ],
} as const satisfies Record<Area, readonly Row[]>;

export const catalogue: Check[] = (Object.keys(rows) as Area[]).flatMap(
    (area) =>
        (rows[area] as readonly Row[]).map(([id, severity, mark]) => ({
            id: id as CheckId,
            area,
            severity,
            isGate: mark === 'gate',
            needs: mark === undefined || mark === 'gate' ? 'raw' : mark,
        })),
);

export const scoredChecks = catalogue.filter((check) =>
    isScored(check.severity),
);

export function checkOf(id: CheckId) {
    return byId.get(id)!;
}

export function isScored(severity: Severity) {
    return severity === '3' || severity === '2' || severity === '1';
}

const byId = new Map(catalogue.map((check) => [check.id, check]));

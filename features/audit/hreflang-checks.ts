import { cappedPerPage, type Finding } from '@/features/audit/finding';
import {
    alternateCount,
    type AlternateSets,
    storedAlternates,
} from '@/features/audit/observe';
import type { AuditPage, PageElement } from '@/features/audit/page';
import { isHttpUrl, isSiteUrl } from '@/features/audit/queue';
import { isAnswered, isNoindexed } from '@/features/audit/score';
import type { SiteContext, SiteRow } from '@/features/audit/site-checks';
import {
    absolute,
    type HreflangEntry,
    hreflangAlternates,
} from '@/features/crawl/html';
import type { Json } from '@/lib/types/database';

export const alternatesListed = 10;

export function isValidHreflang(lang: string) {
    if (lang.toLowerCase() === 'x-default') {
        return true;
    }

    const [, language, script, region] = hreflangShape.exec(lang) ?? [];

    return (
        language !== undefined &&
        names.language.of(language.toLowerCase()) !== undefined &&
        (script === undefined ||
            names.script.of(
                `${script[0].toUpperCase()}${script.slice(1).toLowerCase()}`,
            ) !== undefined) &&
        (region === undefined ||
            (!refusedRegions.has(region.toUpperCase()) &&
                names.region.of(region.toUpperCase()) !== undefined))
    );
}

export function hreflangChecks(
    url: string,
    page: Pick<AuditPage, 'canonicals'> | null,
    alternates: AlternateSets,
): Finding[] {
    if (alternateCount(alternates) === 0) {
        return [];
    }

    const entries = methods.flatMap((method) =>
        alternates[method].map((entry): MethodEntry => ({ ...entry, method })),
    );

    const findings: Finding[] = [];

    for (const entry of entries) {
        const reason =
            codeProblem(entry.lang) ?? (isAbsolute(entry) ? null : 'relative');

        if (reason) {
            findings.push(
                entryFinding('hreflang-code', url, entry, entry.href, {
                    lang: entry.lang,
                    reason,
                    method: entry.method,
                }),
            );
        }

        if (!isHttpUrl(url) && entry.url && isHttpUrl(entry.url)) {
            findings.push(
                entryFinding('hreflang-http', url, entry, entry.url, {
                    method: entry.method,
                }),
            );
        }
    }

    const codes = entries.map(({ lang }) => lang.toLowerCase());

    const languages = [
        ...new Set(
            codes
                .filter((code) => code !== 'x-default' && isValidHreflang(code))
                .map((code) => code.split('-')[0]),
        ),
    ];

    if (languages.length >= 2 && !codes.includes('x-default')) {
        findings.push({
            check: 'hreflang-x-default',
            url,
            detail: { languages },
        });
    }

    for (const canonical of page?.canonicals ?? []) {
        if (canonical.hasHreflang) {
            findings.push({
                check: 'hreflang-on-canonical',
                url,
                subject: canonical.href,
                selector: canonical.selector,
                snippet: canonical.snippet,
            });
        }
    }

    const sets = methods.flatMap((method) =>
        alternates[method].length > 0
            ? [{ method, keys: keysOf(alternates[method]) }]
            : [],
    );

    if (sets.some(({ keys }) => !isSameSet(keys, sets[0].keys))) {
        findings.push({
            check: 'hreflang-methods',
            url,
            detail: { methods: sets.map(({ method }) => method) },
        });
    }

    return cappedPerPage(findings);
}

export function hreflangSiteChecks(
    rows: SiteRow[],
    {
        hosts,
        sitemapAlternates,
    }: Pick<SiteContext, 'hosts' | 'sitemapAlternates'>,
): Finding[] {
    const byUrl = new Map(rows.map((row) => [row.url, row]));

    const sitemapOf = memoised((url) => {
        const alternates = sitemapAlternates.get(url);

        return (
            alternates &&
            new Set(
                alternates.flatMap(
                    ({ href }) => absolute(href, new URL(url)) ?? [],
                ),
            )
        );
    });

    const setOf = memoised(
        (url) =>
            new Set([
                ...storedAlternates(byUrl.get(url)?.hreflang).map(
                    ({ href }) => href,
                ),
                ...(sitemapOf(url) ?? []),
            ]),
    );

    return cappedPerPage(
        rows
            .filter((row) => row.is_indexable)
            .flatMap((row) => [
                ...alternateFindings(row, byUrl, setOf),
                ...sitemapFindings(row, hosts, sitemapOf),
            ]),
    );
}

type Method = keyof AlternateSets;

type MethodEntry = HreflangEntry & Partial<PageElement> & { method: Method };

const methods: Method[] = ['tags', 'header', 'sitemap'];

const hreflangShape = /^([a-z]{2})(?:-([a-z]{4}))?(?:-([a-z]{2}))?$/i;

const refusedRegions = new Set(['EU', 'UN', 'UK']);

const names = {
    language: new Intl.DisplayNames(['en'], {
        type: 'language',
        fallback: 'none',
    }),
    script: new Intl.DisplayNames(['en'], { type: 'script', fallback: 'none' }),
    region: new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }),
};

function codeProblem(lang: string) {
    if (isValidHreflang(lang)) {
        return null;
    }

    const withoutRegion = lang.replace(/-[a-z]{2}$/i, '');

    return withoutRegion !== lang && isValidHreflang(withoutRegion)
        ? 'region'
        : 'code';
}

function isAbsolute({ href, url }: HreflangEntry) {
    return url !== null && /^https?:\/\//i.test(href);
}

function entryFinding(
    check: Finding['check'],
    url: string,
    entry: MethodEntry,
    subject: string,
    detail: Json,
): Finding {
    return {
        check,
        url,
        subject,
        selector: entry.selector,
        snippet: entry.snippet,
        detail,
    };
}

function keysOf(entries: HreflangEntry[]) {
    return new Set(
        hreflangAlternates(entries).map(({ lang, href }) => `${lang} ${href}`),
    );
}

function isSameSet(one: ReadonlySet<string>, other: ReadonlySet<string>) {
    return one.size === other.size && [...one].every((key) => other.has(key));
}

function memoised<Value>(compute: (url: string) => Value) {
    const values = new Map<string, Value>();

    return (url: string) => {
        if (!values.has(url)) {
            values.set(url, compute(url));
        }

        return values.get(url) as Value;
    };
}

function alternateFindings(
    row: SiteRow,
    byUrl: ReadonlyMap<string, SiteRow>,
    setOf: (url: string) => ReadonlySet<string>,
): Finding[] {
    const hrefs = setOf(row.url);

    if (hrefs.size === 0) {
        return [];
    }

    const findings: Finding[] = hrefs.has(row.url)
        ? []
        : [
              {
                  check: 'hreflang-return',
                  url: row.url,
                  subject: row.url,
                  detail: { reason: 'self' },
              },
          ];

    for (const href of hrefs) {
        const alternate = byUrl.get(href);

        if (href === row.url || !alternate || alternate.status_code === null) {
            continue;
        }

        const finding = { url: row.url, subject: href };

        if (!isAnswered(alternate) || isNoindexed(alternate)) {
            findings.push({
                ...finding,
                check: 'hreflang-target',
                detail: {
                    status: alternate.status_code,
                    redirectTo: alternate.redirect_to,
                    isIndexable: alternate.is_indexable,
                },
            });
        }

        if (alternate.canonical_url && alternate.canonical_url !== href) {
            findings.push({
                ...finding,
                check: 'hreflang-target-canonical',
                detail: { canonical: alternate.canonical_url },
            });
        }

        if (isAnswered(alternate)) {
            const verdict = returnVerdict(row.url, hrefs, setOf(href));

            if (verdict) {
                findings.push({
                    ...finding,
                    check: 'hreflang-return',
                    detail: verdict,
                });
            }
        }
    }

    return findings;
}

function sitemapFindings(
    row: SiteRow,
    hosts: string[],
    sitemapOf: (url: string) => ReadonlySet<string> | undefined,
): Finding[] {
    const hrefs = sitemapOf(row.url);

    if (!hrefs || hrefs.size === 0) {
        return [];
    }

    const findings: Finding[] = hrefs.has(row.url)
        ? []
        : [
              {
                  check: 'sitemap-hreflang',
                  url: row.url,
                  subject: row.url,
                  detail: { reason: 'self' },
              },
          ];

    for (const href of hrefs) {
        const back =
            href !== row.url && isSiteUrl(href, hosts)
                ? sitemapOf(href)
                : undefined;

        const verdict = back && returnVerdict(row.url, hrefs, back);

        if (verdict) {
            findings.push({
                check: 'sitemap-hreflang',
                url: row.url,
                subject: href,
                detail: verdict,
            });
        }
    }

    return findings;
}

function returnVerdict(
    url: string,
    hrefs: ReadonlySet<string>,
    back: ReadonlySet<string>,
): Json {
    if (!back.has(url)) {
        return { reason: 'return', notListed: url };
    }

    return isSameSet(back, hrefs)
        ? null
        : {
              reason: 'differs',
              listed: [...hrefs].slice(0, alternatesListed),
              listedBack: [...back].slice(0, alternatesListed),
          };
}

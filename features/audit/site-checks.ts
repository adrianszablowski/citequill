import type { Finding } from '@/features/audit/finding';
import { hreflangSiteChecks } from '@/features/audit/hreflang-checks';
import {
    appliesTo,
    isAnswered,
    isNoindexed,
    isSelfCanonical,
    type ScoredPage,
} from '@/features/audit/score';
import {
    hammingDistance,
    nearDuplicateBits,
    simhashBits,
} from '@/features/audit/simhash';
import { facetPath, facetVolume } from '@/features/audit/url-patterns';
import type { Alternate } from '@/features/crawl/html';
import type { Tables } from '@/lib/types/database';

export type SiteRow = ScoredPage &
    Pick<
        Tables<'site_pages'>,
        | 'body_hash'
        | 'body_simhash'
        | 'title'
        | 'description'
        | 'click_depth'
        | 'inbound_links'
        | 'hreflang'
        | 'has_microdata'
    >;

export interface SiteContext {
    homes: string[];
    hosts: string[];
    isDisallowed: (url: string) => boolean;
    isHttpsSite: boolean;
    linkedFrom: ReadonlyMap<string, string[]>;
    sitemapAlternates: ReadonlyMap<string, Alternate[]>;
}

export const duplicatesListed = 10;

export const noindexSiteShare = 0.95;

export const deepClicks = 4;

export const siteHalves = [
    ['param-duplicates', 'variants'],
    ['facets-indexable', 'volume'],
    ['assets-heavy', 'bytes'],
    ['structured-data-format', 'none'],
] as const;

export const stockTitles = new Set([
    'home',
    'homepage',
    'untitled',
    'index',
    'welcome',
    'new page',
    'default',
    'strona główna',
    'bez tytułu',
    'witamy',
    'nowa strona',
    'domyślna',
]);

export function siteChecks(rows: SiteRow[], context: SiteContext) {
    const byUrl = new Map(rows.map((row) => [row.url, row]));

    return [
        ...noindexFindings(rows, context),
        ...rows.flatMap((row) => canonicalFindings(row, byUrl, context)),
        ...duplicateFindings(
            'duplicate-body',
            onePerPath(rows),
            (row) => row.body_hash,
        ),
        ...variantFindings(rows),
        ...nearDuplicateFindings(rows),
        ...volumeFindings(rows),
        ...duplicateFindings('title-duplicate', rows, (row) =>
            collapsed(row.title),
        ),
        ...duplicateFindings('description-duplicate', rows, (row) =>
            collapsed(row.description),
        ),
        ...boilerplateFindings(rows, context),
        ...appliesTo('page-not-in-sitemap', rows, context.homes)
            .filter((row) => !row.in_sitemap)
            .map((row): Finding => ({
                check: 'page-not-in-sitemap',
                url: row.url,
            })),
        ...rows
            .filter((row) => row.in_sitemap)
            .flatMap((row) => listedFindings(row, context)),
        ...rows.flatMap((row) => reachFindings(row, context)),
        ...rows.flatMap((row) => linkedFindings(row, context)),
        ...hreflangSiteChecks(rows, context),
        ...formatFindings(rows, context),
    ];
}

function formatFindings(rows: SiteRow[], { homes }: SiteContext): Finding[] {
    const indexable = rows.filter((row) => row.is_indexable);

    return indexable.some((row) => row.jsonld_count > 0 || row.has_microdata)
        ? []
        : indexable
              .filter((row) => homes.includes(row.url))
              .map((row) => ({
                  check: 'structured-data-format',
                  url: row.url,
                  detail: { reason: 'none' },
              }));
}

function reachFindings(row: SiteRow, { homes }: SiteContext): Finding[] {
    if (!row.is_indexable || homes.includes(row.url)) {
        return [];
    }

    const detail = { inbound: row.inbound_links, depth: row.click_depth };

    if (row.inbound_links === 0) {
        return row.in_sitemap && row.click_depth === null
            ? [{ check: 'orphan', url: row.url, detail }]
            : [];
    }

    return row.inbound_links === 1 || (row.click_depth ?? 0) >= deepClicks
        ? [{ check: 'link-depth', url: row.url, detail }]
        : [];
}

function linkedFindings(row: SiteRow, { linkedFrom }: SiteContext): Finding[] {
    const verdict = linkedVerdict(row);

    if (!verdict) {
        return [];
    }

    return (linkedFrom.get(row.url) ?? []).map((page) => ({
        check: verdict.check,
        url: page,
        subject: row.url,
        detail: { ...verdict.detail, linkCount: row.inbound_links },
    }));
}

function linkedVerdict(row: SiteRow) {
    if ((row.status_code ?? 0) >= 400) {
        return {
            check: 'link-broken-internal' as const,
            detail: { status: row.status_code },
        };
    }

    if (row.redirect_to) {
        return {
            check: 'link-to-redirect' as const,
            detail: { reason: 'redirect', target: row.redirect_to },
        };
    }

    return row.canonical_url && row.canonical_url !== row.url
        ? {
              check: 'link-to-redirect' as const,
              detail: { reason: 'canonical', target: row.canonical_url },
          }
        : null;
}

function noindexFindings(rows: SiteRow[], { homes }: SiteContext): Finding[] {
    const noindexed = rows.filter(isNoindexed);
    const homesNoindexed = noindexed.filter((row) => homes.includes(row.url));

    if (homesNoindexed.length > 0) {
        return homesNoindexed.map((row) => ({
            check: 'noindex-site',
            url: null,
            subject: row.url,
        }));
    }

    const answered = rows.filter(isAnswered).length;

    return answered > 0 && noindexed.length / answered > noindexSiteShare
        ? [
              {
                  check: 'noindex-site',
                  url: null,
                  detail: { noindexed: noindexed.length, answered },
              },
          ]
        : [];
}

function canonicalFindings(
    row: SiteRow,
    byUrl: ReadonlyMap<string, SiteRow>,
    { hosts }: SiteContext,
): Finding[] {
    const { url, canonical_url: target } = row;

    if (!target || target === url) {
        return [];
    }

    const findings: Finding[] = [];
    const canonical = { url, subject: target };
    const named = byUrl.get(target);

    if (!hosts.includes(new URL(target).hostname)) {
        findings.push({ ...canonical, check: 'canonical-cross-domain' });
    }

    if (named && isError(named)) {
        findings.push({
            ...canonical,
            check: 'canonical-to-error',
            detail: {
                status: named.status_code,
                redirectTo: named.redirect_to,
                isIndexable: named.is_indexable,
            },
        });
    }

    if (named?.canonical_url && named.canonical_url !== named.url) {
        findings.push({
            ...canonical,
            check: 'canonical-chain',
            detail: { next: named.canonical_url },
        });
    }

    return findings;
}

function duplicateFindings(
    check: 'duplicate-body' | 'title-duplicate' | 'description-duplicate',
    rows: SiteRow[],
    valueOf: (row: SiteRow) => string | null,
): Finding[] {
    const groups = new Map<string, SiteRow[]>();

    const valued = rows.flatMap((row) => {
        const value = valueOf(row);

        return row.is_indexable && value ? [{ row, value }] : [];
    });

    for (const { row, value } of valued) {
        const group = groups.get(value) ?? [];

        group.push(row);
        groups.set(value, group);
    }

    for (const group of groups.values()) {
        group.sort((one, other) => (one.url < other.url ? -1 : 1));
    }

    return valued.flatMap(({ row, value }): Finding[] => {
        const duplicates = twinsOf(row, groups.get(value)!);

        return duplicates.length > 0
            ? [
                  {
                      check,
                      url: row.url,
                      subject: duplicates[0],
                      detail: { value, duplicates },
                  },
              ]
            : [];
    });
}

function variantFindings(rows: SiteRow[]): Finding[] {
    const groups = new Map<string, SiteRow[]>();

    for (const row of sortedByUrl(rows)) {
        const key = variantKey(row);

        if (key) {
            groups.set(key, [...(groups.get(key) ?? []), row]);
        }
    }

    return [...groups.values()].flatMap((group) =>
        group.flatMap((row): Finding[] => {
            const duplicates = twinsOf(row, group);

            return duplicates.length > 0
                ? [
                      {
                          check: 'param-duplicates',
                          url: row.url,
                          subject: duplicates[0],
                          detail: {
                              reason: 'variants',
                              value: row.body_hash,
                              duplicates,
                          },
                      },
                  ]
                : [];
        }),
    );
}

function nearDuplicateFindings(rows: SiteRow[]): Finding[] {
    const hashed = sortedByUrl(rows).flatMap((row) =>
        row.is_indexable && row.body_simhash
            ? [{ row, bits: simhashBits(row.body_simhash) }]
            : [],
    );

    const near = new Map<SiteRow, SiteRow[]>(
        hashed.map(({ row }) => [row, []]),
    );

    for (let i = 0; i < hashed.length; i++) {
        for (let j = i + 1; j < hashed.length; j++) {
            const one = hashed[i];
            const other = hashed[j];

            if (
                one.row.body_hash !== other.row.body_hash &&
                hammingDistance(one.bits, other.bits) <= nearDuplicateBits
            ) {
                near.get(one.row)!.push(other.row);
                near.get(other.row)!.push(one.row);
            }
        }
    }

    return [...near].flatMap(([row, others]): Finding[] => {
        const duplicates = twinsOf(row, others);

        return duplicates.length > 0
            ? [
                  {
                      check: 'near-duplicate',
                      url: row.url,
                      subject: duplicates[0],
                      detail: { duplicates },
                  },
              ]
            : [];
    });
}

function volumeFindings(rows: SiteRow[]): Finding[] {
    const groups = new Map<string, SiteRow[]>();

    for (const row of rows) {
        const path = facetPath(row.url);

        if (path && isSelfCanonical(row)) {
            groups.set(path, [...(groups.get(path) ?? []), row]);
        }
    }

    return [...groups].flatMap(([path, group]) =>
        group.length >= facetVolume
            ? group.map((row): Finding => ({
                  check: 'facets-indexable',
                  url: row.url,
                  subject: path,
                  detail: { reason: 'volume', path, count: group.length },
              }))
            : [],
    );
}

function twinsOf(row: SiteRow, others: SiteRow[]) {
    const duplicates: string[] = [];

    for (const other of others) {
        if (duplicates.length === duplicatesListed) {
            break;
        }

        if (other !== row && !hasCanonicalBetween(row, other)) {
            duplicates.push(other.url);
        }
    }

    return duplicates;
}

function hasCanonicalBetween(one: SiteRow, other: SiteRow) {
    return (
        other.canonical_url === one.url ||
        one.canonical_url === other.url ||
        (one.canonical_url !== null &&
            one.canonical_url === other.canonical_url)
    );
}

function onePerPath(rows: SiteRow[]) {
    const kept = new Map<string, SiteRow>();

    for (const row of sortedByUrl(rows)) {
        const key = variantKey(row);
        const held = key && kept.get(key);

        if (
            key &&
            (!held || (isSelfCanonical(row) && !isSelfCanonical(held)))
        ) {
            kept.set(key, row);
        }
    }

    return rows.filter((row) => {
        const key = variantKey(row);

        return !key || kept.get(key) === row;
    });
}

function variantKey({ url, is_indexable, body_hash }: SiteRow) {
    if (!is_indexable || !body_hash) {
        return null;
    }

    const { origin, pathname } = new URL(url);

    return `${origin}${pathname} ${body_hash}`;
}

function sortedByUrl(rows: SiteRow[]) {
    return [...rows].sort((one, other) => (one.url < other.url ? -1 : 1));
}

function boilerplateFindings(
    rows: SiteRow[],
    { homes }: SiteContext,
): Finding[] {
    const titled = rows.flatMap((row) => {
        const title = collapsed(row.title);

        return row.is_indexable && title
            ? [{ row, title, segments: title.split(separator) }]
            : [];
    });

    const counts = new Map<string, number>();

    for (const { segments } of titled) {
        if (segments.length > 1) {
            for (const end of new Set([
                segments[0].toLowerCase(),
                segments.at(-1)!.toLowerCase(),
            ])) {
                counts.set(end, (counts.get(end) ?? 0) + 1);
            }
        }
    }

    const [siteName = null] = [...counts]
        .filter(([, count]) => count >= 2)
        .sort(([a, one], [b, other]) => other - one || a.localeCompare(b))
        .map(([name]) => name);

    return titled.flatMap(({ row, title, segments }): Finding[] => {
        const remainder = withoutSiteName(
            segments.map((segment) => segment.toLowerCase()),
            siteName,
        ).join(' ');

        const isBoilerplate =
            (remainder === '' && !homes.includes(row.url)) ||
            stockTitles.has(remainder);

        return isBoilerplate
            ? [
                  {
                      check: 'title-boilerplate',
                      url: row.url,
                      detail: { title, siteName },
                  },
              ]
            : [];
    });
}

function withoutSiteName(segments: string[], siteName: string | null) {
    if (segments[0] === siteName) {
        return segments.slice(1);
    }

    return segments.at(-1) === siteName ? segments.slice(0, -1) : segments;
}

const separator = /\s+[|\-\u2013\u2014:\u00b7\u00bb\u00ab]\s+/;

function collapsed(text: string | null) {
    return text?.replace(/\s+/g, ' ').trim() || null;
}

function listedFindings(
    row: SiteRow,
    { isDisallowed, isHttpsSite }: SiteContext,
): Finding[] {
    const findings: Finding[] = [];
    const listed = { url: row.url, subject: row.url };

    if ((row.status_code ?? 0) >= 400 || isNoindexed(row)) {
        findings.push({
            ...listed,
            check: 'sitemap-url-error',
            detail: { status: row.status_code, isNoindex: isNoindexed(row) },
        });
    }

    const reasons = [
        ...(row.redirect_to ? ['redirects'] : []),
        ...(row.canonical_url && row.canonical_url !== row.url
            ? ['names another canonical']
            : []),
        ...(isHttpsSite && row.url.startsWith('http:') ? ['http'] : []),
        ...(isDisallowed(row.url) ? ['disallowed'] : []),
    ];

    if (reasons.length > 0) {
        findings.push({
            ...listed,
            check: 'sitemap-url-noncanonical',
            detail: { reasons },
        });
    }

    return findings;
}

function isError(row: SiteRow) {
    return (
        row.redirect_to !== null ||
        (row.status_code ?? 0) >= 400 ||
        isNoindexed(row)
    );
}

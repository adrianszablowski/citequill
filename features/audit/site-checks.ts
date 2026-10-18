import type { Finding } from '@/features/audit/finding';
import {
    appliesTo,
    isAnswered,
    isNoindexed,
    type ScoredPage,
} from '@/features/audit/score';
import type { Tables } from '@/lib/types/database';

export type SiteRow = ScoredPage &
    Pick<Tables<'site_pages'>, 'body_hash' | 'title' | 'description'>;

export interface SiteContext {
    homes: string[];
    hosts: string[];
    isDisallowed: (url: string) => boolean;
    isHttpsSite: boolean;
}

export const duplicatesListed = 10;

export const noindexSiteShare = 0.95;

export const stockTitles = new Set([
    'home',
    'homepage',
    'untitled',
    'index',
    'welcome',
    'new page',
    'default',
]);

export function siteChecks(rows: SiteRow[], context: SiteContext) {
    const byUrl = new Map(rows.map((row) => [row.url, row]));

    return [
        ...noindexFindings(rows, context),
        ...rows.flatMap((row) => canonicalFindings(row, byUrl, context)),
        ...duplicateFindings('duplicate-body', rows, (row) => row.body_hash),
        ...duplicateFindings('title-duplicate', rows, (row) =>
            collapsed(row.title),
        ),
        ...duplicateFindings('description-duplicate', rows, (row) =>
            collapsed(row.description),
        ),
        ...boilerplateFindings(rows, context),
        ...appliesTo('page-not-in-sitemap', rows)
            .filter((row) => !row.in_sitemap)
            .map((row): Finding => ({
                check: 'page-not-in-sitemap',
                url: row.url,
            })),
        ...rows
            .filter((row) => row.in_sitemap)
            .flatMap((row) => listedFindings(row, context)),
    ];
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
        const duplicates: string[] = [];

        for (const other of groups.get(value)!) {
            if (duplicates.length === duplicatesListed) {
                break;
            }

            if (
                other !== row &&
                other.canonical_url !== row.url &&
                row.canonical_url !== other.url
            ) {
                duplicates.push(other.url);
            }
        }

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

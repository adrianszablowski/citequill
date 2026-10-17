import type { Finding } from '@/features/audit/finding';
import {
    appliesTo,
    isAnswered,
    isNoindexed,
    type ScoredPage,
} from '@/features/audit/score';

export type SiteRow = ScoredPage & { body_hash: string | null };

export interface SiteContext {
    homes: string[];
    hosts: string[];
    isDisallowed: (url: string) => boolean;
    isHttpsSite: boolean;
}

export const duplicatesListed = 10;

export const noindexSiteShare = 0.95;

export function siteChecks(rows: SiteRow[], context: SiteContext) {
    const byUrl = new Map(rows.map((row) => [row.url, row]));

    return [
        ...noindexFindings(rows, context),
        ...rows.flatMap((row) => canonicalFindings(row, byUrl, context)),
        ...duplicateFindings(rows),
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

function duplicateFindings(rows: SiteRow[]): Finding[] {
    const groups = new Map<string, SiteRow[]>();
    const twins = new Map<SiteRow, string[]>();

    for (const row of rows) {
        if (row.is_indexable && row.body_hash) {
            const group = groups.get(row.body_hash) ?? [];

            group.push(row);
            groups.set(row.body_hash, group);
            twins.set(row, []);
        }
    }

    for (const group of groups.values()) {
        group.forEach((row, index) => {
            for (const other of group.slice(index + 1)) {
                if (
                    other.canonical_url !== row.url &&
                    row.canonical_url !== other.url
                ) {
                    twins.get(row)!.push(other.url);
                    twins.get(other)!.push(row.url);
                }
            }
        });
    }

    return [...twins].flatMap(([row, urls]) => {
        urls.sort();

        return urls.length > 0
            ? [
                  {
                      check: 'duplicate-body',
                      url: row.url,
                      subject: urls[0],
                      detail: { duplicates: urls.slice(0, duplicatesListed) },
                  } as const,
              ]
            : [];
    });
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

import type { Finding } from '@/features/audit/finding';
import { repeatedWord } from '@/features/audit/on-page-checks';
import type { AuditPage } from '@/features/audit/page';
import { isSelfCanonical } from '@/features/audit/score';
import {
    facetPath,
    isSearchUrl,
    isUtilityUrl,
    pagination,
    saysNoResults,
    trackingParameter,
} from '@/features/audit/url-patterns';
import { absolute } from '@/features/crawl/html';
import type { TablesInsert } from '@/lib/types/database';

export interface HeuristicContext {
    hosts: string[];
    isDisallowed: (url: string) => boolean;
}

export function heuristicChecks(
    url: string,
    row: TablesInsert<'site_pages'>,
    page: AuditPage,
    directives: string[],
    { hosts, isDisallowed }: HeuristicContext,
): Finding[] {
    const isIndexable = row.is_indexable === true;

    const isInternal = (href: string) => {
        const target = absolute(href, new URL(url));

        return target !== null && hosts.includes(new URL(target).hostname);
    };

    return [
        ...paginationFindings(url, row, page, directives, isInternal),
        ...spamFindings(url, page),
        ...(isIndexable
            ? indexableFindings(url, row, page, isInternal, isDisallowed)
            : []),
    ];
}

function indexableFindings(
    url: string,
    row: TablesInsert<'site_pages'>,
    page: AuditPage,
    isInternal: (href: string) => boolean,
    isDisallowed: (url: string) => boolean,
): Finding[] {
    const findings: Finding[] = [];

    if (isSearchUrl(url) && !isDisallowed(url)) {
        findings.push({ check: 'search-results-indexable', url });
    }

    if (isUtilityUrl(url)) {
        findings.push({ check: 'utility-indexable', url });
    }

    if (
        isSelfCanonical(row) &&
        facetPath(url) !== null &&
        page.wordCount < emptyFacetWords &&
        saysNoResults(page.mainText)
    ) {
        findings.push({
            check: 'facets-indexable',
            url,
            detail: { reason: 'empty' },
        });
    }

    const tracked = page.links
        .filter(isInternal)
        .map((link) => ({ link, parameter: trackingParameter(link) }))
        .find(({ parameter }) => parameter !== null);

    if (tracked) {
        findings.push({
            check: 'param-duplicates',
            url,
            subject: tracked.link,
            snippet: tracked.link,
            detail: { reason: 'tracking', parameter: tracked.parameter },
        });
    }

    const blocked = page.assets.filter(isDisallowed);

    if (blocked.length > 0) {
        findings.push({
            check: 'robots-assets-blocked',
            url,
            subject: blocked[0],
            detail: { blocked: blocked.length },
        });
    }

    return findings;
}

function paginationFindings(
    url: string,
    row: TablesInsert<'site_pages'>,
    page: AuditPage,
    directives: string[],
    isInternal: (href: string) => boolean,
): Finding[] {
    const findings: Finding[] = [];
    const position = pagination(url);

    if (position && position.page > 1) {
        const isNoindex = directives.some(
            (directive) => directive === 'noindex' || directive === 'none',
        );

        const isSeriesCanonical =
            row.canonical_url === position.series ||
            row.canonical_url === position.first;

        if (isNoindex || isSeriesCanonical) {
            findings.push({
                check: 'pagination-canonical',
                url,
                subject: isNoindex ? null : row.canonical_url,
                detail: {
                    reason: isNoindex ? 'noindex' : 'canonical',
                    series: position.series,
                },
            });
        }
    }

    const fragment = page.fragmentLinks.find(isInternal);

    if (fragment !== undefined) {
        findings.push({
            check: 'pagination-canonical',
            url,
            subject: fragment,
            snippet: fragment,
            detail: { reason: 'fragment' },
        });
    }

    return findings;
}

function spamFindings(url: string, page: AuditPage): Finding[] {
    return page.hiddenBlocks.flatMap((block): Finding[] => {
        const word = repeatedWord(block.text);

        return word
            ? [
                  {
                      check: 'spam-pattern',
                      url,
                      selector: block.selector,
                      snippet: block.snippet,
                      detail: { words: block.words, word },
                  },
              ]
            : [];
    });
}

const emptyFacetWords = 100;

import {
    checkSorts,
    type FindingListQuery,
    findingListDefaults,
    sitePageSorts,
} from '@/features/audit/schema';
import { sectionHref } from '@/lib/sections';

export function findingListHref(
    projectId: string,
    query: Partial<FindingListQuery>,
) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        if (
            value !== undefined &&
            value !== findingListDefaults[key as keyof FindingListQuery]
        ) {
            params.set(key, String(value));
        }
    }

    const search = params.toString();
    const href = sectionHref(projectId, 'audit');

    return search ? (`${href}?${search}` as const) : href;
}

export function keptFindingParams(query: FindingListQuery) {
    const kept: [string, string][] = [];

    for (const key of ['view', 'sort', 'size'] as const) {
        const value = query[key];

        if (value !== undefined && value !== findingListDefaults[key]) {
            kept.push([key, String(value)]);
        }
    }

    return kept;
}

export function hasFindingFilters(query: FindingListQuery) {
    return Boolean(
        query.severity ||
        query.locale ||
        (query.view === 'finding' ? query.area : query.written || query.q),
    );
}

export function checkSort(query: FindingListQuery) {
    return checkSorts.find((sort) => sort === query.sort) ?? 'severity';
}

export function sitePageSort(query: FindingListQuery) {
    return sitePageSorts.find((sort) => sort === query.sort) ?? 'findings';
}

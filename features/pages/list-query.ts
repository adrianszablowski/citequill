import { type PageListQuery, pageListDefaults } from '@/features/pages/schema';
import { sectionHref } from '@/lib/sections';

export function pageListHref(projectId: string, query: Partial<PageListQuery>) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
        if (
            value !== undefined &&
            value !== pageListDefaults[key as keyof PageListQuery]
        ) {
            params.set(key, String(value));
        }
    }

    const search = params.toString();
    const href = sectionHref(projectId, 'pages');

    return search ? (`${href}?${search}` as const) : href;
}

export function keptParams(query: PageListQuery) {
    const kept: [string, string][] = [];

    for (const key of ['kind', 'sort', 'dir', 'size'] as const) {
        const value = query[key];

        if (value !== undefined && value !== pageListDefaults[key]) {
            kept.push([key, String(value)]);
        }
    }

    return kept;
}

export function hasFilters(query: PageListQuery) {
    return Boolean(
        query.q || query.locale || query.status || query.from || query.to,
    );
}

export function titlePattern(q: string) {
    return `%${q.replace(/[\\%_]/g, '\\$&')}%`;
}

export function pageNumbers(current: number, last: number) {
    const numbers = new Set([1, current - 1, current, current + 1, last]);
    const items: (number | 'gap')[] = [];

    for (const n of [...numbers]
        .filter((n) => n >= 1 && n <= last)
        .sort((a, b) => a - b)) {
        const previous = items.at(-1);

        if (typeof previous === 'number' && n - previous > 1) {
            items.push('gap');
        }

        items.push(n);
    }

    return items;
}

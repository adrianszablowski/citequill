import { describe, expect, it } from 'vitest';

import {
    checkSort,
    findingListHref,
    hasFindingFilters,
    keptFindingParams,
    sitePageSort,
} from '@/features/audit/list-query';
import { findingListQuery } from '@/features/audit/schema';

describe('findingListQuery', () => {
    it('falls back to the findings by check, 10 rows a page, on an empty URL', () => {
        expect(findingListQuery.parse({})).toEqual({
            view: 'finding',
            page: 1,
            size: 10,
        });
    });

    it('drops a value it does not know, keeping the rest', () => {
        expect(
            findingListQuery.parse({
                view: 'images',
                check: 'no-such-check',
                severity: '4',
                area: 'links',
                locale: ' pl ',
                size: '25',
            }),
        ).toEqual({
            view: 'finding',
            area: 'links',
            locale: 'pl',
            page: 1,
            size: 10,
        });
    });
});

describe('findingListHref', () => {
    it('leaves the defaults out of the URL', () => {
        expect(
            findingListHref('p1', findingListQuery.parse({ page: '1' })),
        ).toBe('/projects/p1/audit');
    });

    it('writes every other parameter', () => {
        expect(
            findingListHref('p1', {
                ...findingListQuery.parse({}),
                view: 'page',
                q: 'blog',
                page: 2,
            }),
        ).toBe('/projects/p1/audit?view=page&page=2&q=blog');
    });
});

describe('keptFindingParams', () => {
    it('keeps the view, the sort and the size for the filter form', () => {
        expect(
            keptFindingParams(
                findingListQuery.parse({
                    view: 'page',
                    sort: 'url',
                    size: '50',
                    q: 'blog',
                }),
            ),
        ).toEqual([
            ['view', 'page'],
            ['sort', 'url'],
            ['size', '50'],
        ]);
    });
});

describe('hasFindingFilters', () => {
    it('counts only the filters of the view on screen', () => {
        expect(
            hasFindingFilters(findingListQuery.parse({ written: 'yes' })),
        ).toBe(false);

        expect(
            hasFindingFilters(
                findingListQuery.parse({ view: 'page', written: 'yes' }),
            ),
        ).toBe(true);

        expect(hasFindingFilters(findingListQuery.parse({}))).toBe(false);
    });
});

describe('checkSort and sitePageSort', () => {
    it('sorts each view by its default when the URL names the sort of the other', () => {
        const query = findingListQuery.parse({ sort: 'url' });

        expect(checkSort(query)).toBe('severity');
        expect(sitePageSort(query)).toBe('url');
        expect(sitePageSort(findingListQuery.parse({}))).toBe('findings');
    });
});

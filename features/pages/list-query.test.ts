import { describe, expect, it } from 'vitest';

import {
    hasFilters,
    keptParams,
    pageListHref,
    pageNumbers,
    titlePattern,
} from '@/features/pages/list-query';
import { pageListQuery } from '@/features/pages/schema';

describe('pageListQuery', () => {
    it('falls back to the defaults on an empty URL', () => {
        expect(pageListQuery.parse({})).toEqual({
            sort: 'updated_at',
            dir: 'desc',
            page: 1,
            size: 10,
        });
    });

    it('reads every parameter from strings', () => {
        expect(
            pageListQuery.parse({
                kind: 'k1',
                q: ' deload ',
                locale: 'pl',
                status: 'draft',
                from: '2026-10-01',
                to: '2026-10-31',
                sort: 'title',
                dir: 'asc',
                page: '3',
                size: '50',
            }),
        ).toEqual({
            kind: 'k1',
            q: 'deload',
            locale: 'pl',
            status: 'draft',
            from: '2026-10-01',
            to: '2026-10-31',
            sort: 'title',
            dir: 'asc',
            page: 3,
            size: 50,
        });
    });

    it('drops a bad value and keeps the rest', () => {
        expect(
            pageListQuery.parse({
                q: '',
                status: 'gone',
                from: 'yesterday',
                sort: 'body_md',
                dir: 'sideways',
                page: '0',
                size: '7',
                kind: ['a', 'b'],
            }),
        ).toEqual({ sort: 'updated_at', dir: 'desc', page: 1, size: 10 });
    });
});

describe('pageListHref', () => {
    it('is the section when every value is a default', () => {
        expect(pageListHref('p1', { sort: 'updated_at', page: 1 })).toBe(
            '/projects/p1/pages',
        );
    });

    it('writes only what differs from the defaults', () => {
        expect(
            pageListHref('p1', {
                kind: 'k1',
                q: 'deload week',
                page: 2,
                size: 10,
            }),
        ).toBe('/projects/p1/pages?kind=k1&q=deload+week&page=2');
    });
});

describe('keptParams', () => {
    it('keeps the kind, the sort and the size a filter form must not lose', () => {
        const query = pageListQuery.parse({
            kind: 'k1',
            q: 'x',
            sort: 'title',
            page: '3',
            size: '50',
        });

        expect(keptParams(query)).toEqual([
            ['kind', 'k1'],
            ['sort', 'title'],
            ['size', '50'],
        ]);
    });
});

describe('hasFilters', () => {
    it('ignores kind, sort and paging', () => {
        const base = pageListQuery.parse({ kind: 'k1', page: '2' });

        expect(hasFilters(base)).toBe(false);
        expect(hasFilters({ ...base, status: 'draft' })).toBe(true);
        expect(hasFilters({ ...base, locale: 'pl' })).toBe(true);
    });
});

describe('titlePattern', () => {
    it('escapes the wildcards of like', () => {
        expect(titlePattern('100%_sure\\')).toBe('%100\\%\\_sure\\\\%');
    });
});

describe('pageNumbers', () => {
    it('lists every page when there are few', () => {
        expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    });

    it('keeps the first, the last and the neighbours with gaps', () => {
        expect(pageNumbers(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
        expect(pageNumbers(1, 10)).toEqual([1, 2, 'gap', 10]);
        expect(pageNumbers(10, 10)).toEqual([1, 'gap', 9, 10]);
    });

    it('is one page for one page', () => {
        expect(pageNumbers(1, 1)).toEqual([1]);
    });
});

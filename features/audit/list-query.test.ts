import { describe, expect, it } from 'vitest';

import {
    checkSort,
    findingListHref,
    hasFindingFilters,
    imageSort,
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

    it('carries an image subject with a query string back to the same subject', () => {
        const subject = 'https://cdn.acme.com/logo.png?w=200&h=100#top';

        const href = findingListHref('p1', {
            ...findingListQuery.parse({}),
            view: 'image',
            subject,
        });

        const search = new URL(href, 'https://citequill.test').searchParams;

        expect(
            findingListQuery.parse(Object.fromEntries(search)),
        ).toMatchObject({ view: 'image', subject });
    });

    it('leaves the subject out of the URL when no image is open', () => {
        expect(
            findingListHref('p1', {
                ...findingListQuery.parse({ view: 'image' }),
                subject: undefined,
            }),
        ).toBe('/projects/p1/audit?view=image');
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

    it('counts only the language on the images', () => {
        expect(
            hasFindingFilters(
                findingListQuery.parse({ view: 'image', severity: '3' }),
            ),
        ).toBe(false);

        expect(
            hasFindingFilters(
                findingListQuery.parse({ view: 'image', locale: 'pl' }),
            ),
        ).toBe(true);
    });
});

describe('imageSort', () => {
    it('sorts the images by their pages unless the URL names the subject', () => {
        expect(imageSort(findingListQuery.parse({}))).toBe('pages');

        expect(imageSort(findingListQuery.parse({ sort: 'severity' }))).toBe(
            'pages',
        );

        expect(imageSort(findingListQuery.parse({ sort: 'subject' }))).toBe(
            'subject',
        );
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

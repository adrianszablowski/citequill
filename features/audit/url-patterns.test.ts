import { describe, expect, it } from 'vitest';

import {
    facetPath,
    isSearchUrl,
    isUtilityUrl,
    pagination,
    saysNoResults,
    saysNotFound,
    trackingParameter,
} from '@/features/audit/url-patterns';

const site = 'https://acme.com';

describe('isSearchUrl', () => {
    it('finds a search segment or parameter, in English and Polish and in any case', () => {
        for (const path of [
            '/search',
            '/pl/Szukaj/buty',
            '/wyszukiwarka',
            '/?s=shoes',
            '/shop?Q=shoes',
            '/?query=a',
            '/?search=',
            '/?szukaj=buty',
        ]) {
            expect(isSearchUrl(`${site}${path}`), path).toBe(true);
        }
    });

    it('leaves a word that only contains one, and other parameters, alone', () => {
        for (const path of ['/research', '/searches', '/?sort=price', '/']) {
            expect(isSearchUrl(`${site}${path}`), path).toBe(false);
        }
    });
});

describe('facetPath', () => {
    it('gives the origin and path of a URL with a sort or filter parameter', () => {
        expect(facetPath(`${site}/shoes?color=red&page=2`)).toBe(
            `${site}/shoes`,
        );

        expect(facetPath(`${site}/buty?Rozmiar=42`)).toBe(`${site}/buty`);
    });

    it('gives nothing for a URL with no facet parameter', () => {
        expect(facetPath(`${site}/shoes?page=2`)).toBeNull();
        expect(facetPath(`${site}/sort/price`)).toBeNull();
    });
});

describe('pagination', () => {
    it('reads the page number of a path and the series without it', () => {
        expect(pagination(`${site}/blog/page/3/`)).toEqual({
            page: 3,
            series: `${site}/blog/`,
            first: `${site}/blog/page/1/`,
        });

        expect(pagination(`${site}/Strona/2`)).toEqual({
            page: 2,
            series: `${site}/`,
            first: `${site}/Strona/1`,
        });
    });

    it('reads the page number of a parameter and keeps the other parameters', () => {
        expect(pagination(`${site}/shoes?color=red&page=4`)).toEqual({
            page: 4,
            series: `${site}/shoes?color=red`,
            first: `${site}/shoes?color=red&page=1`,
        });

        expect(pagination(`${site}/buty?STRONA=2`)).toMatchObject({
            page: 2,
            series: `${site}/buty`,
        });
    });

    it('finds no pagination without a number after the name', () => {
        expect(pagination(`${site}/page/about`)).toBeNull();
        expect(pagination(`${site}/blog?page=last`)).toBeNull();
        expect(pagination(`${site}/pages/2`)).toBeNull();
        expect(pagination(`${site}/blog`)).toBeNull();
    });
});

describe('isUtilityUrl', () => {
    it('finds a print, thank-you, login or cart segment, or a print parameter', () => {
        for (const path of [
            '/print/article',
            '/drukuj',
            '/order/thank-you',
            '/Dziekujemy',
            '/podziekowanie',
            '/thanks',
            '/login',
            '/logowanie',
            '/signin',
            '/wp-login.php',
            '/cart',
            '/koszyk',
            '/checkout',
            '/zamowienie',
            '/article?print=1',
        ]) {
            expect(isUtilityUrl(`${site}${path}`), path).toBe(true);
        }
    });

    it('leaves a content page alone', () => {
        expect(isUtilityUrl(`${site}/blog/printing-tips`)).toBe(false);
        expect(isUtilityUrl(`${site}/carts-for-sale`)).toBe(false);
    });
});

describe('trackingParameter', () => {
    it('names the first tracking or session parameter, utm_ as a prefix and in any case', () => {
        expect(trackingParameter(`${site}/a?utm_source=x`)).toBe('utm_source');
        expect(trackingParameter(`${site}/a?page=2&GCLID=1`)).toBe('gclid');

        for (const name of [
            'fbclid',
            'msclkid',
            'mc_cid',
            'sessionid',
            'sid',
            'phpsessid',
            'jsessionid',
        ]) {
            expect(trackingParameter(`${site}/a?${name}=1`), name).toBe(name);
        }
    });

    it('names nothing on a URL with other parameters or none', () => {
        expect(trackingParameter(`${site}/a?page=2`)).toBeNull();
        expect(trackingParameter(`${site}/utm_source`)).toBeNull();
    });
});

describe('saysNoResults', () => {
    it('finds a no-results phrase in English or Polish, in any case', () => {
        expect(saysNoResults('Shoes. No results for red.')).toBe(true);
        expect(saysNoResults('0 results')).toBe(true);
        expect(saysNoResults('Nothing found')).toBe(true);
        expect(saysNoResults('Brak wyników')).toBe(true);
        expect(saysNoResults('nic nie znaleziono')).toBe(true);
        expect(saysNoResults('Nie znaleziono produktów.')).toBe(true);
    });

    it('leaves a count that only ends in zero and other text alone', () => {
        expect(saysNoResults('10 results')).toBe(false);
        expect(saysNoResults('120 results for shoes')).toBe(false);
        expect(saysNoResults('Results of the survey')).toBe(false);
    });
});

describe('saysNotFound', () => {
    it('names the error phrase a text says, in English or Polish, in any case', () => {
        expect(saysNotFound('Page Not Found | Acme')).toBe('page not found');
        expect(saysNotFound('Not found')).toBe('not found');
        expect(saysNotFound('Error 404')).toBe('404');
        expect(saysNotFound('Błąd 404 – Acme')).toBe('błąd 404');
        expect(saysNotFound('Strona nie istnieje')).toBe('strona nie istnieje');
        expect(saysNotFound('Nie znaleziono')).toBe('nie znaleziono');
    });

    it('reads only a whole phrase, so a longer number or word is not one', () => {
        expect(saysNotFound('Order 4040')).toBeNull();
        expect(saysNotFound('Room 404b')).toBeNull();
        expect(saysNotFound('Founders not foundational')).toBeNull();
        expect(saysNotFound('Pricing')).toBeNull();
    });
});

import { describe, expect, it } from 'vitest';

import {
    isIdentifier,
    samplePages,
    topLevelPages,
    urlPattern,
} from '@/features/audit/sample';

const site = 'https://acme.com';
const homes = ['https://acme.com', 'https://acme.de'];
const at = (path: string, origin = site) => `${origin}${path}`;

describe('samplePages', () => {
    it('takes the home pages first, then the top-level pages, then one page per pattern', () => {
        expect(
            samplePages(
                [
                    at('/blog/first-post'),
                    at('/pricing'),
                    at('/blog/second-post'),
                    at('/'),
                    at('/shop/shoes/red'),
                    at('/about'),
                    at('/shop/shoes/blue'),
                    at('/', 'https://acme.de'),
                ],
                homes,
                50,
            ),
        ).toEqual([
            at('/'),
            at('/', 'https://acme.de'),
            at('/pricing'),
            at('/about'),
            at('/blog/first-post'),
            at('/shop/shoes/red'),
        ]);
    });

    it(`takes ${topLevelPages} top-level pages at most`, () => {
        const topLevel = Array.from({ length: 12 }, (_, index) =>
            at(`/page-${index}`),
        );

        expect(samplePages([...topLevel, at('/blog/a')], homes, 50)).toEqual([
            ...topLevel.slice(0, topLevelPages),
            at('/blog/a'),
        ]);
    });

    it('stops at the limit, keeping the home pages first', () => {
        expect(
            samplePages([at('/a'), at('/b'), at('/'), at('/c/d')], homes, 2),
        ).toEqual([at('/'), at('/a')]);
    });

    it('gives the same sample for the same input order, and an empty one for no pages', () => {
        const urls = [at('/x/1'), at('/y/2'), at('/x/3')];

        expect(samplePages(urls, homes, 20)).toEqual(
            samplePages([...urls], homes, 20),
        );

        expect(samplePages([], homes, 20)).toEqual([]);
    });
});

describe('urlPattern', () => {
    it('groups paths by their first segment and their depth', () => {
        expect(urlPattern(at('/blog/one'))).toBe(urlPattern(at('/blog/two')));
        expect(urlPattern(at('/blog/one'))).not.toBe(urlPattern(at('/blog')));

        expect(urlPattern(at('/blog/one'))).not.toBe(
            urlPattern(at('/shop/one')),
        );

        expect(urlPattern(at('/Blog/one'))).toBe(urlPattern(at('/blog/one')));
    });

    it('replaces a segment that looks like an identifier: digits, a UUID or a date', () => {
        for (const first of [
            '/123/a',
            '/2026-10-18/a',
            '/2026-10/a',
            '/0b9f6c1e-7a52-4d4e-9b0a-3c2f1e0d9a8b/a',
        ]) {
            expect(urlPattern(at(first)), first).toBe(urlPattern(at('/42/b')));
        }

        expect(urlPattern(at('/v2/a'))).not.toBe(urlPattern(at('/42/a')));
    });
});

describe('isIdentifier', () => {
    it('reads digits, a UUID and a date as an identifier, and a slug as none', () => {
        for (const segment of [
            '12345',
            '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
            '2024-05-17',
            '2024-05',
        ]) {
            expect(isIdentifier(segment), segment).toBe(true);
        }

        for (const segment of ['red-shoes', '12345-red-shoes', 'v2']) {
            expect(isIdentifier(segment), segment).toBe(false);
        }
    });
});

import { describe, expect, it } from 'vitest';

import {
    internalLinkFindings,
    pagePath,
    readingMinutes,
    slugify,
    uniqueSlug,
} from '@/features/pages/draft';

describe('slugify', () => {
    it('turns a title into a lowercase ascii slug', () => {
        expect(slugify('Jak zacząć trening siłowy? 5 kroków')).toBe(
            'jak-zaczac-trening-silowy-5-krokow',
        );
    });

    it('gives an empty slug for a title without letters or digits', () => {
        expect(slugify('???')).toBe('');
    });
});

describe('uniqueSlug', () => {
    it('keeps a free slug and numbers a taken one', () => {
        expect(uniqueSlug('deload-week', [])).toBe('deload-week');

        expect(uniqueSlug('deload-week', ['deload-week'])).toBe(
            'deload-week-2',
        );

        expect(
            uniqueSlug('deload-week', ['deload-week', 'deload-week-2']),
        ).toBe('deload-week-3');
    });

    it('names an empty slug page', () => {
        expect(uniqueSlug('', ['page'])).toBe('page-2');
    });
});

describe('pagePath', () => {
    it('joins the locale base, the kind prefix and the slug with single slashes', () => {
        expect(pagePath('https://acme.com/', '/blog/', 'deload-week')).toBe(
            'https://acme.com/blog/deload-week',
        );

        expect(pagePath('https://acme.com/pl', '', 'deload')).toBe(
            'https://acme.com/pl/deload',
        );
    });
});

describe('readingMinutes', () => {
    it('reads 200 words a minute and never says zero', () => {
        expect(readingMinutes('')).toBe(1);
        expect(readingMinutes(Array(900).fill('word').join(' '))).toBe(5);
    });
});

describe('internalLinkFindings', () => {
    const known = ['https://acme.com/', 'https://www.acme.com/pricing/'];

    it('accepts a link to a known page in any of its spellings', () => {
        const body =
            '[a](/pricing) [b](https://acme.com/pricing/) [c](https://www.acme.com/)';

        expect(internalLinkFindings(body, 'https://acme.com', known)).toEqual(
            [],
        );
    });

    it('names a link to the site that Citequill does not know, once', () => {
        const body = '[a](/blog/missing) [b](/blog/missing) [c](/pricing)';

        expect(internalLinkFindings(body, 'https://acme.com', known)).toEqual([
            "The link to /blog/missing is not among the pages Citequill knows; link to one of the site's pages or remove it.",
        ]);
    });

    it('leaves links to other sites alone', () => {
        const body = '[a](https://example.org/x) [b](mailto:hi@acme.com)';

        expect(internalLinkFindings(body, 'https://acme.com', known)).toEqual(
            [],
        );
    });
});

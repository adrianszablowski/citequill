import { describe, expect, it } from 'vitest';

import {
    isSameLanguage,
    languagesSkill,
    localesFrom,
} from '@/features/crawl/locales';

describe('localesFrom', () => {
    it('reads a locale per hreflang with its base URL and skips x-default', () => {
        const locales = localesFrom('https://acme.com', [
            {
                lang: 'en',
                alternates: [
                    { lang: 'en', href: 'https://acme.com/' },
                    { lang: 'pl', href: 'https://acme.com/pl/' },
                    { lang: 'de-de', href: 'https://de.acme.com/' },
                    { lang: 'x-default', href: 'https://acme.com/' },
                ],
            },
            {
                lang: 'en',
                alternates: [
                    { lang: 'en', href: 'https://acme.com/blog/first' },
                    { lang: 'pl', href: 'https://acme.com/pl/blog/pierwszy' },
                ],
            },
        ]);

        expect(locales).toEqual([
            { locale: 'en', base_url: 'https://acme.com', is_default: true },
            {
                locale: 'pl',
                base_url: 'https://acme.com/pl',
                is_default: false,
            },
            {
                locale: 'de-de',
                base_url: 'https://de.acme.com',
                is_default: false,
            },
        ]);
    });

    it('keeps a path prefix only when it is the locale code', () => {
        const [en] = localesFrom('https://acme.com', [
            {
                lang: null,
                alternates: [{ lang: 'en', href: 'https://acme.com/blog/a' }],
            },
        ]);

        expect(en.base_url).toBe('https://acme.com');
    });

    it('falls back to the html lang and the origin when there are no alternates', () => {
        expect(
            localesFrom('https://www.acme.com', [
                { lang: null, alternates: [] },
                { lang: 'pl-pl', alternates: [] },
            ]),
        ).toEqual([
            {
                locale: 'pl-pl',
                base_url: 'https://www.acme.com',
                is_default: true,
            },
        ]);
    });

    it('is English at the origin when nothing says otherwise', () => {
        expect(localesFrom('https://acme.com', [])).toEqual([
            { locale: 'en', base_url: 'https://acme.com', is_default: true },
        ]);
    });

    it('makes the locale at the origin the default when the home page has no lang', () => {
        const locales = localesFrom('https://acme.com', [
            {
                lang: null,
                alternates: [
                    { lang: 'pl', href: 'https://acme.com/pl/' },
                    { lang: 'en', href: 'https://acme.com/' },
                ],
            },
        ]);

        expect(locales.find((locale) => locale.is_default)?.locale).toBe('en');
    });
});

describe('isSameLanguage', () => {
    it('compares the language and ignores the region, and a page without a lang is in every language', () => {
        expect(isSameLanguage('en-US', 'en')).toBe(true);
        expect(isSameLanguage('pl', 'en-gb')).toBe(false);
        expect(isSameLanguage(null, 'en')).toBe(true);
        expect(isSameLanguage('pl', undefined)).toBe(true);
    });
});

describe('languagesSkill', () => {
    it('names every language with its address and the main one the crawl read', () => {
        const skill = languagesSkill([
            {
                locale: 'pl',
                base_url: 'https://acme.com/pl',
                is_default: false,
            },
            { locale: 'en', base_url: 'https://acme.com', is_default: true },
        ]);

        expect(skill.body).toBe(
            [
                'The site has 2 languages. The crawl read the pages in English, so the other product skills describe the site in English.',
                '',
                '- Polish (`pl`) at https://acme.com/pl',
                '- English (`en`) at https://acme.com, the main language',
            ].join('\n'),
        );

        expect(skill.description).toContain('English as the main one');
        expect(skill.description.length).toBeLessThan(160);
    });

    it('keeps an unknown code as its own name', () => {
        const skill = languagesSkill([
            { locale: 'xx-zz', base_url: 'https://acme.com', is_default: true },
        ]);

        expect(skill.body).toContain('one language');
        expect(skill.body).toContain('- xx-zz (`xx-zz`) at https://acme.com');
    });
});

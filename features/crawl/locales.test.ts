import { describe, expect, it } from 'vitest';

import {
    canonicalLocale,
    isSameLanguage,
    languagesSkill,
    localeOf,
    localesFrom,
} from '@/features/crawl/locales';

describe('localeOf', () => {
    const locales = [
        { locale: 'en', base_url: 'https://acme.com', is_default: true },
        { locale: 'de', base_url: 'https://acme.com/de', is_default: false },
        { locale: 'fr', base_url: 'https://acme.fr', is_default: false },
    ];

    it('names the locale whose base URL holds the page, the longest one first', () => {
        expect(localeOf('https://acme.com/pricing', locales)).toBe('en');
        expect(localeOf('https://acme.com/de/preise', locales)).toBe('de');
        expect(localeOf('https://acme.com/de', locales)).toBe('de');
        expect(localeOf('https://acme.fr/', locales)).toBe('fr');
    });

    it('matches a prefix only at a segment and nothing on another host', () => {
        expect(localeOf('https://acme.com/deals', locales)).toBe('en');
        expect(localeOf('https://www.acme.com/pricing', locales)).toBeNull();
    });
});

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
                locale: 'de-DE',
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
                locale: 'pl-PL',
                base_url: 'https://www.acme.com',
                is_default: true,
            },
        ]);
    });

    it('skips an hreflang or an html lang whose language is not 2 or 3 letters, so no such value becomes a locale', () => {
        expect(
            localesFrom('https://acme.com', [
                {
                    lang: 'fr',
                    alternates: [
                        { lang: 'english', href: 'https://acme.com/' },
                        { lang: 'en.us', href: 'https://acme.com/us/' },
                        { lang: 'fr', href: 'https://acme.com/fr/' },
                    ],
                },
            ]),
        ).toEqual([
            { locale: 'fr', base_url: 'https://acme.com/fr', is_default: true },
        ]);

        expect(
            localesFrom('https://acme.com', [
                { lang: null, alternates: [] },
                { lang: 'english', alternates: [] },
                { lang: 'de', alternates: [] },
            ]),
        ).toEqual([
            { locale: 'de', base_url: 'https://acme.com', is_default: true },
        ]);
    });

    it("takes English at the origin as the main language when the home page's lang is no language tag, never another page's or the first hreflang", () => {
        expect(
            localesFrom('https://acme.com', [
                {
                    lang: 'english',
                    alternates: [
                        { lang: 'english', href: 'https://acme.com/' },
                        { lang: 'fr', href: 'https://acme.com/fr/' },
                    ],
                },
            ]),
        ).toEqual([
            {
                locale: 'fr',
                base_url: 'https://acme.com/fr',
                is_default: false,
            },
            { locale: 'en', base_url: 'https://acme.com', is_default: true },
        ]);

        expect(
            localesFrom('https://acme.com', [
                { lang: 'english', alternates: [] },
                { lang: 'de', alternates: [] },
            ]),
        ).toEqual([
            { locale: 'en', base_url: 'https://acme.com', is_default: true },
        ]);

        expect(
            localesFrom('https://acme.com', [
                { lang: 'polski', alternates: [] },
            ]),
        ).toEqual([
            { locale: 'en', base_url: 'https://acme.com', is_default: true },
        ]);
    });

    it("keeps the hreflang locale at the origin as the main language when the home page's lang is no language tag", () => {
        expect(
            localesFrom('https://acme.com', [
                {
                    lang: 'english',
                    alternates: [
                        { lang: 'en-us', href: 'https://acme.com/' },
                        { lang: 'fr', href: 'https://acme.com/fr/' },
                    ],
                },
            ]),
        ).toEqual([
            {
                locale: 'en-US',
                base_url: 'https://acme.com',
                is_default: true,
            },
            {
                locale: 'fr',
                base_url: 'https://acme.com/fr',
                is_default: false,
            },
        ]);
    });

    it('is English at the origin when nothing says otherwise', () => {
        expect(localesFrom('https://acme.com', [])).toEqual([
            { locale: 'en', base_url: 'https://acme.com', is_default: true },
        ]);
    });

    it('keeps one locale per canonical tag, with the base URL of the tag that already is that locale, in either order', () => {
        const tags = [
            { lang: 'es-419', href: 'https://acme.com/es-419/' },
            { lang: 'es', href: 'https://acme.com/es/' },
        ];

        for (const alternates of [tags, [...tags].reverse()]) {
            const locales = localesFrom('https://acme.com', [
                {
                    lang: 'en-us',
                    alternates: [
                        ...alternates,
                        { lang: 'en-us', href: 'https://acme.com/' },
                    ],
                },
            ]);

            expect(locales, alternates[0].lang).toEqual([
                {
                    locale: 'es',
                    base_url: 'https://acme.com/es',
                    is_default: false,
                },
                {
                    locale: 'en-US',
                    base_url: 'https://acme.com',
                    is_default: true,
                },
            ]);

            expect(localeOf('https://acme.com/es/precios', locales)).toBe('es');

            expect(localeOf('https://acme.com/es-419/precios', locales)).toBe(
                'en-US',
            );
        }
    });

    it('keeps the base URL of the first tag when none of them already is the locale', () => {
        expect(
            localesFrom('https://acme.com', [
                {
                    lang: null,
                    alternates: [
                        { lang: 'es-419', href: 'https://acme.com/es-419/' },
                        { lang: 'es_419', href: 'https://acme.com/es_419/' },
                    ],
                },
            ]),
        ).toEqual([
            {
                locale: 'es',
                base_url: 'https://acme.com/es-419',
                is_default: true,
            },
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

describe('canonicalLocale', () => {
    it('lowercases the language and uppercases a two-letter region', () => {
        expect(canonicalLocale('EN-us')).toBe('en-US');
        expect(canonicalLocale('pt_br')).toBe('pt-BR');
        expect(canonicalLocale('pl')).toBe('pl');
        expect(canonicalLocale('en-US')).toBe('en-US');
    });

    it('drops a region that is not two letters, and whatever follows the region', () => {
        expect(canonicalLocale('es-419')).toBe('es');
        expect(canonicalLocale('zh-Hant-TW')).toBe('zh');
        expect(canonicalLocale('sr-RS-latn')).toBe('sr-RS');
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

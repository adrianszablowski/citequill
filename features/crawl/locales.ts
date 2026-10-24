import type { Alternate } from '@/features/crawl/html';

export interface Locale {
    locale: string;
    base_url: string;
    is_default: boolean;
}

export interface LocaleSource {
    lang: string | null;
    alternates: Alternate[];
}

export function localesFrom(origin: string, pages: LocaleSource[]): Locale[] {
    const bases = new Map<string, string>();

    const isFromCanonicalTag = new Set<string>();

    for (const { lang, href } of pages.flatMap((page) => page.alternates)) {
        const locale = validLocale(lang);

        if (!locale) {
            continue;
        }

        const isCanonicalTag = lang.toLowerCase() === locale.toLowerCase();

        if (
            isFromCanonicalTag.has(locale) ||
            (bases.has(locale) && !isCanonicalTag)
        ) {
            continue;
        }

        bases.set(locale, baseUrl(href, lang));

        if (isCanonicalTag) {
            isFromCanonicalTag.add(locale);
        }
    }

    const homeTag = pages[0]?.lang ?? null;
    const homeLang = validLocale(homeTag);
    const isHomeMistagged = Boolean(homeTag) && !homeLang;

    if (bases.size === 0) {
        return [
            {
                locale: isHomeMistagged
                    ? 'en'
                    : (pages
                          .map((page) => validLocale(page.lang))
                          .find(Boolean) ?? 'en'),
                base_url: origin,
                is_default: true,
            },
        ];
    }

    const atOrigin = [...bases].find(([, base]) => base === origin)?.[0];

    if (isHomeMistagged && !atOrigin) {
        bases.set('en', origin);
    }

    const defaultLocale = isHomeMistagged
        ? (atOrigin ?? 'en')
        : ([...bases].find(([lang]) => lang === homeLang)?.[0] ??
          atOrigin ??
          [...bases.keys()][0]);

    return [...bases].map(([locale, base_url]) => ({
        locale,
        base_url,
        is_default: locale === defaultLocale,
    }));
}

export function localeOf(url: string, locales: Locale[]) {
    return (
        locales
            .filter(
                ({ base_url }) =>
                    url === base_url ||
                    url.startsWith(`${base_url.replace(/\/+$/, '')}/`),
            )
            .sort((a, b) => b.base_url.length - a.base_url.length)[0]?.locale ??
        null
    );
}

export function isSameLanguage(
    lang: string | null,
    locale: string | null | undefined,
) {
    return (
        !lang || !locale || primaryLanguage(lang) === primaryLanguage(locale)
    );
}

export function languagesSkill(locales: Locale[]) {
    const main = locales.find((locale) => locale.is_default) ?? locales[0];
    const mainName = languageName(main.locale);

    const lines = locales.map(
        (locale) =>
            `- ${languageName(locale.locale)} (\`${locale.locale}\`) at ${locale.base_url}${locale === main ? ', the main language' : ''}`,
    );

    const count =
        locales.length === 1 ? 'one language' : `${locales.length} languages`;

    return {
        description: `The site's ${count} with the address of each, ${mainName} as the main one; read before writing in another language than ${mainName}.`,
        body: `The site has ${count}. The crawl read the pages in ${mainName}, so the other product skills describe the site in ${mainName}.\n\n${lines.join('\n')}`,
    };
}

export function canonicalLocale(tag: string) {
    const [language, region = ''] = tag.split(/[-_]/);

    return /^[a-z]{2}$/i.test(region)
        ? `${language.toLowerCase()}-${region.toUpperCase()}`
        : language.toLowerCase();
}

export function validLocale(tag: string | null) {
    return tag && /^[a-z]{2,3}$/.test(primaryLanguage(tag))
        ? canonicalLocale(tag)
        : null;
}

export function primaryLanguage(tag: string) {
    return tag.toLowerCase().split(/[-_]/)[0];
}

export function languageName(locale: string) {
    try {
        return (
            new Intl.DisplayNames(['en'], {
                type: 'language',
                fallback: 'none',
            }).of(locale.replace('_', '-')) ?? locale
        );
    } catch {
        return locale;
    }
}

function baseUrl(href: string, lang: string) {
    const url = new URL(href);
    const [first] = url.pathname.split('/').filter(Boolean);

    const prefix =
        first && isLocaleSegment(first, lang) ? `/${first.toLowerCase()}` : '';

    return `${url.origin}${prefix}`;
}

function isLocaleSegment(segment: string, lang: string) {
    const code = segment.toLowerCase();

    return (
        code === lang ||
        code === lang.split('-')[0] ||
        code.replace('_', '-') === lang
    );
}

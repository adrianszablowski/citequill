import { XMLParser, XMLValidator } from 'fast-xml-parser';

import type { Alternate } from '@/features/crawl/html';

export interface SitemapUrl {
    loc: string;
    lastmod: string | null;
    priority: string | null;
    changefreq: string | null;
    alternates: Alternate[];
    images: Record<string, unknown>[];
    videos: Record<string, unknown>[];
}

export interface Sitemap {
    urls: SitemapUrl[];
    sitemaps: { loc: string; lastmod: string | null }[];
    root: 'urlset' | 'sitemapindex' | null;
    namespace: string | null;
    isWellFormed: boolean;
    rejected: string[];
}

export const emptySitemap: Sitemap = {
    urls: [],
    sitemaps: [],
    root: null,
    namespace: null,
    isWellFormed: false,
    rejected: [],
};

export function sitemapsFromRobots(robots: string) {
    return robots
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^sitemap:/i.test(line))
        .map((line) => line.slice('sitemap:'.length).trim())
        .filter(isHttpUrl);
}

export function sitemapEntries(xml: string) {
    const sitemap = readSitemap(xml);

    return {
        pages: sitemap.urls.map((url) => url.loc),
        sitemaps: sitemap.sitemaps.map((child) => child.loc),
    };
}

export function readSitemap(xml: string): Sitemap {
    let parsed: Parsed;

    try {
        parsed = parser.parse(xml) as Parsed;
    } catch {
        return emptySitemap;
    }

    const urls = parsed.urlset?.url ?? [];
    const sitemaps = parsed.sitemapindex?.sitemap ?? [];

    return {
        urls: urls.flatMap((entry) => {
            const loc = text(entry.loc);

            return isHttpUrl(loc)
                ? [
                      {
                          loc,
                          lastmod: text(entry.lastmod) || null,
                          priority: text(entry.priority) || null,
                          changefreq: text(entry.changefreq) || null,
                          alternates: (entry.link ?? []).flatMap(alternate),
                          images: entry.image ?? [],
                          videos: entry.video ?? [],
                      },
                  ]
                : [];
        }),
        sitemaps: sitemaps.flatMap((entry) => {
            const loc = text(entry.loc);

            return isHttpUrl(loc)
                ? [{ loc, lastmod: text(entry.lastmod) || null }]
                : [];
        }),
        root: rootOf(parsed),
        namespace:
            /<(?:urlset|sitemapindex)\b[^>]*\sxmlns\s*=\s*["']([^"']*)["']/.exec(
                xml,
            )?.[1] ?? null,
        isWellFormed: XMLValidator.validate(xml) === true,
        rejected: [...urls, ...sitemaps]
            .map((entry) => text(entry.loc))
            .filter((loc) => !isHttpUrl(loc)),
    };
}

interface Entry {
    loc?: unknown;
    lastmod?: unknown;
    priority?: unknown;
    changefreq?: unknown;
    link?: Record<string, unknown>[];
    image?: Record<string, unknown>[];
    video?: Record<string, unknown>[];
}

interface Parsed {
    urlset?: { url?: Entry[] };
    sitemapindex?: { sitemap?: Entry[] };
}

const repeated = new Set(['url', 'sitemap', 'link', 'image', 'video']);

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
    parseTagValue: false,
    isArray: (name) => repeated.has(name),
});

function rootOf(parsed: Parsed) {
    if (parsed.urlset !== undefined) {
        return 'urlset';
    }

    return parsed.sitemapindex === undefined ? null : 'sitemapindex';
}

function text(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function alternate(link: Record<string, unknown>): Alternate[] {
    const lang = text(link.hreflang).toLowerCase();
    const href = text(link.href);

    return link.rel === 'alternate' && lang && href ? [{ lang, href }] : [];
}

function isHttpUrl(value: string) {
    return /^https?:\/\//i.test(value);
}

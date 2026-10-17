import { XMLParser } from 'fast-xml-parser';

import type { Alternate } from '@/features/crawl/html';

export interface SitemapUrl {
    loc: string;
    lastmod: string | null;
    alternates: Alternate[];
    images: Record<string, unknown>[];
    videos: Record<string, unknown>[];
}

export interface Sitemap {
    urls: SitemapUrl[];
    sitemaps: { loc: string; lastmod: string | null }[];
}

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
        return { urls: [], sitemaps: [] };
    }

    return {
        urls: (parsed.urlset?.url ?? []).flatMap((entry) => {
            const loc = text(entry.loc);

            return isHttpUrl(loc)
                ? [
                      {
                          loc,
                          lastmod: text(entry.lastmod) || null,
                          alternates: (entry.link ?? []).flatMap(alternate),
                          images: entry.image ?? [],
                          videos: entry.video ?? [],
                      },
                  ]
                : [];
        }),
        sitemaps: (parsed.sitemapindex?.sitemap ?? []).flatMap((entry) => {
            const loc = text(entry.loc);

            return isHttpUrl(loc)
                ? [{ loc, lastmod: text(entry.lastmod) || null }]
                : [];
        }),
    };
}

interface Entry {
    loc?: unknown;
    lastmod?: unknown;
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

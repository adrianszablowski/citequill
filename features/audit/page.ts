import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';

import {
    absolute,
    type Alternate,
    alternatesOf,
    mainContent,
    robotsMetaOf,
} from '@/features/crawl/html';

export interface AuditPage {
    title: string | null;
    lang: string | null;
    canonical: string | null;
    robotsMeta: string[];
    alternates: Alternate[];
    links: string[];
    bodyHash: string | null;
}

export function readAuditPage(html: string, url: string): AuditPage {
    const $ = cheerio.load(html);
    const base = new URL(url);

    const links = $('a[href]')
        .toArray()
        .map((element) => absolute($(element).attr('href'), base))
        .filter((href) => href !== null);

    const page = {
        title: $('title').first().text().trim() || null,
        lang: $('html').attr('lang')?.trim().toLowerCase() || null,
        canonical: absolute($('link[rel="canonical"]').attr('href'), base),
        robotsMeta: robotsMetaOf($),
        alternates: alternatesOf($, base),
        links: [...new Set(links)],
    };

    const text = cheerio
        .load(mainContent($))
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    return {
        ...page,
        bodyHash: text ? createHash('sha256').update(text).digest('hex') : null,
    };
}

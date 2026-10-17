import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';

import { selectorOf } from '@/features/audit/finding';
import {
    absolute,
    type Alternate,
    alternatesOf,
    mainContent,
    robotsMetaOf,
} from '@/features/crawl/html';

export interface CanonicalTag {
    href: string;
    isInHead: boolean;
    selector: string;
    snippet: string;
}

export interface AuditPage {
    title: string | null;
    lang: string | null;
    canonical: string | null;
    canonicals: CanonicalTag[];
    robotsMeta: string[];
    refresh: string | null;
    alternates: Alternate[];
    links: string[];
    bodyHash: string | null;
    wordCount: number;
}

export function readAuditPage(html: string, url: string): AuditPage {
    const $ = cheerio.load(html);
    const base = new URL(url);

    const links = $('a[href]')
        .toArray()
        .map((element) => absolute($(element).attr('href'), base))
        .filter((href) => href !== null);

    const canonicals = $('link[rel="canonical"]')
        .toArray()
        .map((element) => ({
            href: $(element).attr('href')?.trim() ?? '',
            isInHead: $(element).parents('head').length > 0,
            selector: selectorOf(element),
            snippet: $.html(element),
        }));

    const refresh = $('meta[http-equiv]')
        .toArray()
        .find(
            (element) =>
                $(element).attr('http-equiv')?.trim().toLowerCase() ===
                'refresh',
        );

    const page = {
        title: $('title').first().text().trim() || null,
        lang: $('html').attr('lang')?.trim().toLowerCase() || null,
        canonical: absolute(canonicals[0]?.href, base),
        canonicals,
        robotsMeta: robotsMetaOf($),
        refresh: refresh ? ($(refresh).attr('content') ?? '') : null,
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
        wordCount: text ? text.split(' ').length : 0,
    };
}

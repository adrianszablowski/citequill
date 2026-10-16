import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

import {
    jsonLdNodes,
    readSignals,
    type Signals,
} from '@/features/crawl/signals';

export interface Alternate {
    lang: string;
    href: string;
}

export interface PageData {
    title: string;
    lang: string | null;
    alternates: Alternate[];
    author: string | null;
    links: string[];
    navLinks: string[];
    signals: Signals;
    markdown: string;
}

export function readPage(html: string, url: string): PageData {
    const $ = cheerio.load(html);
    const base = new URL(url);

    const alternates = $('link[rel="alternate"][hreflang]')
        .toArray()
        .flatMap((element) => {
            const lang = $(element).attr('hreflang')?.trim().toLowerCase();
            const href = absolute($(element).attr('href'), base);

            return lang && href ? [{ lang, href }] : [];
        });

    const links = siteLinks($, 'a[href]', base);
    const navLinks = siteLinks($, 'header a, nav a, footer a', base);
    const signals = readSignals($, base);

    const author =
        $('meta[name="author"]').attr('content')?.trim() ||
        jsonLdAuthor(jsonLdNodes($));

    $(stripped).remove();

    const content =
        $('main').html() ||
        $('[role="main"]').html() ||
        $('article').html() ||
        $('body').html();

    return {
        title: $('title').first().text().trim(),
        lang: $('html').attr('lang')?.trim().toLowerCase() || null,
        alternates,
        author: author || null,
        links,
        navLinks,
        signals,
        markdown: toMarkdown(content ?? ''),
    };
}

export function toMarkdown(html: string) {
    return turndown
        .turndown(html)
        .replace(/(?:[ \t]*\n){3,}/g, '\n\n')
        .trim();
}

const stripped = [
    'script',
    'style',
    'noscript',
    'template',
    'svg',
    'iframe',
    'nav',
    'header',
    'footer',
    'aside',
    'form',
    '[hidden]',
    '[aria-hidden="true"]',
    '[style*="display:none"]',
    '[style*="display: none"]',
].join(', ');

const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
});

turndown.use(tables);

function siteLinks($: cheerio.CheerioAPI, selector: string, base: URL) {
    return unique(
        $(selector)
            .toArray()
            .map((element) => absolute($(element).attr('href'), base))
            .filter(
                (href): href is string =>
                    href !== null && sameSite(new URL(href), base),
            ),
    );
}

function absolute(href: string | undefined, base: URL) {
    if (!href) {
        return null;
    }

    try {
        const url = new URL(href, base);

        if (!/^https?:$/.test(url.protocol)) {
            return null;
        }

        url.hash = '';

        return url.href;
    } catch {
        return null;
    }
}

function sameSite(url: URL, base: URL) {
    return (
        url.hostname.replace(/^www\./, '') ===
        base.hostname.replace(/^www\./, '')
    );
}

function unique(values: string[]) {
    return [...new Set(values)];
}

function jsonLdAuthor(nodes: unknown[]) {
    for (const node of nodes) {
        const author = (node as Record<string, unknown>).author;

        if (typeof author === 'string' && author.trim()) {
            return author.trim();
        }

        for (const entry of [author].flat()) {
            const name = (entry as Record<string, unknown> | null)?.name;

            if (typeof name === 'string' && name.trim()) {
                return name.trim();
            }
        }
    }

    return null;
}

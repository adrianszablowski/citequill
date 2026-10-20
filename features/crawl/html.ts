import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import TurndownService from 'turndown';
import { tables } from 'turndown-plugin-gfm';

import { hidingStyle } from '@/features/audit/hidden';
import {
    jsonLdNodes,
    readSignals,
    type Signals,
} from '@/features/crawl/signals';

export interface Alternate {
    lang: string;
    href: string;
}

export interface HreflangEntry {
    lang: string;
    href: string;
    url: string | null;
}

export interface PageData {
    title: string;
    lang: string | null;
    alternates: Alternate[];
    robots: string[];
    author: string | null;
    links: string[];
    navLinks: string[];
    signals: Signals;
    markdown: string;
}

export function readPage(html: string, url: string): PageData {
    const $ = cheerio.load(html);
    const base = new URL(url);
    const alternates = alternatesOf($, base);
    const robots = robotsMetaOf($);
    const links = siteLinks($, 'a[href]', base);
    const navLinks = siteLinks($, 'header a, nav a, footer a', base);
    const signals = readSignals($, base);

    const author =
        $('meta[name="author"]').attr('content')?.trim() ||
        jsonLdAuthor(jsonLdNodes($));

    const content = mainElement($)?.html() ?? '';

    return {
        title: $('title').first().text().trim(),
        lang: $('html').attr('lang')?.trim().toLowerCase() || null,
        alternates,
        robots,
        author: author || null,
        links,
        navLinks,
        signals,
        markdown: toMarkdown(content),
    };
}

export function alternatesOf($: cheerio.CheerioAPI, base: URL): Alternate[] {
    return hreflangAlternates(
        alternateLinks($, base).map(({ entry }) => entry),
    );
}

export function alternateLinks($: cheerio.CheerioAPI, base: URL) {
    return $('link[rel~="alternate" i][hreflang]')
        .toArray()
        .flatMap((element) => {
            const rel = (element.attribs.rel ?? '').toLowerCase().split(/\s+/);
            const href = element.attribs.href?.trim() ?? '';

            return rel.includes('stylesheet') || href === ''
                ? []
                : [
                      {
                          element,
                          entry: {
                              lang: element.attribs.hreflang.trim(),
                              href,
                              url: absolute(href, base),
                          },
                      },
                  ];
        });
}

export function hreflangAlternates(entries: HreflangEntry[]): Alternate[] {
    const alternates = new Map<string, Alternate>();

    for (const { lang, url } of entries) {
        const code = lang.toLowerCase();

        if (code && url) {
            alternates.set(`${code} ${url}`, { lang: code, href: url });
        }
    }

    return [...alternates.values()];
}

export function robotsMetaOf(
    $: cheerio.CheerioAPI,
    agent: 'googlebot' | 'bingbot' = 'googlebot',
) {
    const names = ['robots', agent];

    return $('meta[name][content]')
        .toArray()
        .filter((element) =>
            names.includes(
                ($(element).attr('name') ?? '').trim().toLowerCase(),
            ),
        )
        .map((element) => $(element).attr('content') ?? '');
}

export function mainElement($: cheerio.CheerioAPI) {
    const h1 = $('h1').first();
    const h1Article = h1.parents('article').last();

    $(stripped).remove();

    $('body [style]')
        .filter((_, element) => hidingStyle(element.attribs.style) === 'none')
        .remove();

    const isInDocument = (element: cheerio.Cheerio<Element>) =>
        element.parents('html').length > 0;

    const body = $('body').first();
    const longest = longestArticle($);

    // An H1 outside every article stands over articles that are teasers of
    // other posts, unless one of them holds over half of the body's text.
    const isTeaser =
        h1Article.length === 0 &&
        isInDocument(h1) &&
        2 * textLength(longest) <= textLength(body);

    return [
        ...mainLandmarks.map((selector) => $(selector).first()),
        ...[
            isInDocument(h1Article) ? h1Article : $([]),
            isTeaser ? $([]) : longest,
        ].filter((article) => textLength(article) > 0),
        body,
    ].find((element) => element.html());
}

export function isLandmark(element: cheerio.Cheerio<AnyNode>) {
    return [...mainLandmarks, 'article'].some((selector) =>
        element.is(selector),
    );
}

export function absolute(href: string | null | undefined, base: URL) {
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

export function toMarkdown(html: string) {
    return turndown
        .turndown(html)
        .replace(/(?:[ \t]*\n){3,}/g, '\n\n')
        .trim();
}

const mainLandmarks = ['main', '[role="main"]'] as const;

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
    'dialog',
    '[role="dialog" i]',
    '[role="alertdialog" i]',
    '[aria-modal="true" i]',
    '[hidden]',
    '[aria-hidden="true" i]',
].join(', ');

const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
});

turndown.use(tables);

function longestArticle($: cheerio.CheerioAPI) {
    return $('article')
        .toArray()
        .map((element) => $(element))
        .reduce(
            (longest, article) =>
                textLength(article) > textLength(longest) ? article : longest,
            $('article').first(),
        );
}

function textLength(element: cheerio.Cheerio<Element>) {
    return element.text().replace(/\s+/g, ' ').trim().length;
}

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

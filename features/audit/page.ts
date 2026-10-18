import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { selectorOf } from '@/features/audit/finding';
import { hidingStyle } from '@/features/audit/hidden';
import { imagesOf, type PageImage } from '@/features/audit/images';
import { simhash } from '@/features/audit/simhash';
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

export interface PageElement {
    selector: string;
    snippet: string;
}

export interface TitleTag extends PageElement {
    text: string;
    isInHead: boolean;
}

export interface DescriptionTag {
    content: string;
    isInHead: boolean;
}

export interface Heading extends PageElement {
    level: number;
}

export interface Plugin extends PageElement {
    name: string;
}

export interface HiddenBlock extends PageElement {
    words: number;
    text: string;
}

export interface Anchor extends PageElement {
    href: string | null;
    url: string | null;
    text: string;
    name: string;
    hasImage: boolean;
    rel: string[];
}

export interface AuditPage {
    title: string | null;
    titles: TitleTag[];
    descriptions: DescriptionTag[];
    h1s: string[];
    headings: Heading[];
    hasDoctype: boolean;
    hasMetaCharset: boolean;
    misplaced: PageElement[];
    openGraph: string[];
    ogImages: string[];
    ogUrl: string | null;
    modifiedTime: string | null;
    plugins: Plugin[];
    visibleText: string;
    markupLength: number;
    images: PageImage[];
    lang: string | null;
    canonical: string | null;
    canonicals: CanonicalTag[];
    robotsMeta: string[];
    refresh: string | null;
    alternates: Alternate[];
    anchors: Anchor[];
    links: string[];
    assets: string[];
    hiddenBlocks: HiddenBlock[];
    fragmentLinks: string[];
    mainText: string;
    bodyHash: string | null;
    simhash: string | null;
    wordCount: number;
}

export const thinPageWords = 150;

export function readAuditPage(html: string, url: string): AuditPage {
    const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
    const base = new URL(url);
    const inDocument = documentElements($);
    const located = locatedOf($);
    const headEnd = html.search(/<\/head\s*>|<body[\s>]/i);

    const titles = inDocument('title').map((tag) => ({
        ...located(tag),
        text: $(tag).text().trim(),
        isInHead: isInHead($, tag),
    }));

    const metas = inDocument('meta').map((tag) => ({
        keys: [tag.attribs.name, tag.attribs.property].map(
            (key) => key?.trim().toLowerCase() ?? '',
        ),
        content: tag.attribs.content?.trim() ?? '',
        isInHead: isInHead($, tag),
        attribs: tag.attribs,
    }));

    const body = $('body').clone();

    body.find('script, style, template, noscript').remove();

    const anchors = inDocument('a').map((tag): Anchor => {
        const href = tag.attribs.href ?? null;

        return {
            ...located(tag),
            href,
            url: absolute(href, base),
            text: $(tag).text().replace(/\s+/g, ' ').trim(),
            name:
                [
                    tag.attribs['aria-label'],
                    tag.attribs.title,
                    ...$(tag)
                        .find('img[alt]')
                        .toArray()
                        .map((image) => image.attribs.alt),
                ]
                    .map((value) => value?.trim())
                    .find(Boolean) ?? '',
            hasImage: $(tag).find('img').length > 0,
            rel: (tag.attribs.rel ?? '')
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean),
        };
    });

    const ogContents = (key: string) =>
        metas.flatMap(({ keys, content }) =>
            content && keys.includes(key) ? [content] : [],
        );

    const assets = $('link[rel~="stylesheet" i][href], script[src]')
        .toArray()
        .map((element) =>
            absolute($(element).attr('href') ?? $(element).attr('src'), base),
        )
        .filter((href) => href !== null);

    const canonicals = $('link[rel="canonical"]')
        .toArray()
        .map((element) => ({
            href: $(element).attr('href')?.trim() ?? '',
            isInHead: isInHead($, element),
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
        title: titles[0]?.text || null,
        titles,
        descriptions: metas
            .filter(({ keys }) => keys[0] === 'description')
            .map(({ content, isInHead }) => ({ content, isInHead })),
        h1s: inDocument('h1').map((tag) => {
            const text = $(tag).text().replace(/\s+/g, ' ').trim();

            return (
                text ||
                $(tag)
                    .find('img[alt]')
                    .toArray()
                    .map((image) => image.attribs.alt.trim())
                    .filter(Boolean)
                    .join(' ')
            );
        }),
        headings: inDocument('h1, h2, h3, h4, h5, h6').map((tag) => ({
            ...located(tag),
            level: Number(tag.name.slice(1)),
        })),
        hasDoctype: $.root()
            .contents()
            .toArray()
            .some((node) => node.type === 'directive'),
        hasMetaCharset: metas.some(
            ({ attribs }) =>
                Boolean(attribs.charset?.trim()) ||
                (attribs['http-equiv']?.trim().toLowerCase() ===
                    'content-type' &&
                    /charset=/i.test(attribs.content ?? '')),
        ),
        misplaced:
            headEnd < 0
                ? []
                : inDocument('title, meta, link, base, style')
                      .filter(
                          (tag) =>
                              !isInHead($, tag) &&
                              (tag.startIndex ?? Infinity) < headEnd,
                      )
                      .map(located),
        openGraph: [
            ...new Set(
                metas.flatMap(({ keys, content }) =>
                    content ? keys.filter((key) => key.startsWith('og:')) : [],
                ),
            ),
        ],
        ogImages: [
            ...new Set(
                ogContents('og:image').flatMap(
                    (content) => absolute(content, base) ?? [],
                ),
            ),
        ],
        ogUrl: absolute(ogContents('og:url')[0], base),
        modifiedTime:
            metas.find(({ keys }) => keys.includes('article:modified_time'))
                ?.content || null,
        plugins: inDocument('frame, frameset, applet, object, embed')
            .filter(isPlugin)
            .map((tag) => ({ ...located(tag), name: tag.name })),
        visibleText: body.text().replace(/\s+/g, ' ').trim(),
        markupLength: html.replace(scriptOrStyle, '').length,
        images: imagesOf($, base),
        lang: $('html').attr('lang')?.trim().toLowerCase() || null,
        canonical: absolute(canonicals[0]?.href, base),
        canonicals,
        robotsMeta: robotsMetaOf($),
        refresh: refresh ? ($(refresh).attr('content') ?? '') : null,
        alternates: alternatesOf($, base),
        anchors,
        links: [...new Set(anchors.flatMap((anchor) => anchor.url ?? []))],
        assets: [...new Set(assets)],
        hiddenBlocks: hiddenBlocksOf($, body),
        fragmentLinks: anchors.flatMap(({ href }) =>
            href !== null && pageFragment.test(href) ? [href] : [],
        ),
    };

    const mainText = cheerio
        .load(mainContent($))
        .text()
        .replace(/\s+/g, ' ')
        .trim();

    return {
        ...page,
        mainText,
        bodyHash: mainText
            ? createHash('sha256').update(mainText).digest('hex')
            : null,
        simhash: simhash(mainText),
        wordCount: mainText ? mainText.split(' ').length : 0,
    };
}

const pluginTypes = [
    'application/x-shockwave-flash',
    'application/x-java-applet',
    'application/x-silverlight',
];

const pluginFiles = /\.(swf|jar|class|xap)$/;

const hiddenBlockWords = 50;

const pageFragment = /#(?:page|strona)=\d+$/i;

const blockControls = 'a, button, input, select, textarea';

const scriptOrStyle = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

function documentElements($: cheerio.CheerioAPI) {
    return (selector: cheerio.SelectorType) =>
        $(selector)
            .toArray()
            .filter(
                (tag) =>
                    $(tag).parents('html').length > 0 &&
                    $(tag).parents('svg').length === 0,
            );
}

function locatedOf($: cheerio.CheerioAPI) {
    return (tag: Element) => ({
        selector: selectorOf(tag),
        snippet: $.html(tag),
    });
}

function hiddenBlocksOf(
    $: cheerio.CheerioAPI,
    body: cheerio.Cheerio<Element>,
): HiddenBlock[] {
    return body
        .find('[style]')
        .toArray()
        .filter(
            (element) =>
                isOffscreen(element) &&
                !$(element).parents('[style]').toArray().some(isOffscreen) &&
                $(element).find(blockControls).length === 0,
        )
        .map((element) => {
            const text = $(element).text().replace(/\s+/g, ' ').trim();

            return {
                selector: selectorOf(element),
                snippet: $.html(element),
                words: text ? text.split(' ').length : 0,
                text,
            };
        })
        .filter(({ words }) => words >= hiddenBlockWords);
}

function isOffscreen(element: Element) {
    return hidingStyle(element.attribs.style) === 'offscreen';
}

function isInHead($: cheerio.CheerioAPI, tag: Element) {
    return $(tag).parents('head').length > 0;
}

function isPlugin({ name, attribs }: Element) {
    if (name !== 'object' && name !== 'embed') {
        return true;
    }

    const type = attribs.type?.trim().toLowerCase() ?? '';

    return (
        pluginTypes.some((plugin) => type.startsWith(plugin)) ||
        [attribs.src, attribs.data].some((file) =>
            pluginFiles.test((file ?? '').toLowerCase().split(/[?#]/)[0]),
        )
    );
}

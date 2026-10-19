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
    alternateLinks,
    type HreflangEntry,
    hreflangAlternates,
    mainContent,
    robotsMetaOf,
} from '@/features/crawl/html';

export interface CanonicalTag {
    href: string;
    isInHead: boolean;
    hasHreflang: boolean;
    selector: string;
    snippet: string;
}

export interface PageElement {
    selector: string;
    snippet: string;
}

export type AlternateTag = HreflangEntry & PageElement;

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
    text: string;
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

export interface ResourceRef extends PageElement {
    kind: 'script' | 'stylesheet' | 'iframe' | 'image' | 'media';
    url: string | null;
}

export interface PageForm extends PageElement {
    action: string | null;
    hasPassword: boolean;
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
    elementCount: number;
    images: PageImage[];
    lang: string | null;
    canonical: string | null;
    canonicals: CanonicalTag[];
    robotsMeta: string[];
    refresh: string | null;
    alternateTags: AlternateTag[];
    alternates: Alternate[];
    anchors: Anchor[];
    links: string[];
    resources: ResourceRef[];
    assets: string[];
    forms: PageForm[];
    hasLonePassword: boolean;
    viewport: string | null;
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

    const resources = inDocument(resourceSelector).flatMap((tag) =>
        resourceAttributes
            .filter(({ selector }) => $(tag).is(selector))
            .flatMap(({ kind, attribute }) =>
                (attribute === 'srcset'
                    ? srcsetUrls(tag.attribs.srcset)
                    : [tag.attribs[attribute].trim()]
                ).map((value) => ({
                    ...located(tag),
                    kind,
                    url: absolute(value, base),
                })),
            ),
    );

    const canonicals = $('link[rel="canonical"]')
        .toArray()
        .map((element) => ({
            href: $(element).attr('href')?.trim() ?? '',
            isInHead: isInHead($, element),
            hasHreflang: $(element).attr('hreflang') !== undefined,
            selector: selectorOf(element),
            snippet: $.html(element),
        }));

    const alternateTags = alternateLinks($, base)
        .filter(({ element }) => isInDocument($, element))
        .map(({ element, entry }): AlternateTag => ({
            ...located(element),
            ...entry,
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
            text: $(tag).text().replace(/\s+/g, ' ').trim(),
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
        elementCount: inDocument('*' as cheerio.SelectorType).length,
        images: imagesOf($, base),
        lang: $('html').attr('lang')?.trim().toLowerCase() || null,
        canonical: absolute(canonicals[0]?.href, base),
        canonicals,
        robotsMeta: robotsMetaOf($),
        refresh: refresh ? ($(refresh).attr('content') ?? '') : null,
        alternateTags,
        alternates: hreflangAlternates(alternateTags),
        anchors,
        links: [...new Set(anchors.flatMap((anchor) => anchor.url ?? []))],
        resources,
        assets: [
            ...new Set(
                resources.flatMap(({ kind, url }) =>
                    url && (kind === 'script' || kind === 'stylesheet')
                        ? [url]
                        : [],
                ),
            ),
        ],
        forms: inDocument('form').map((tag) => ({
            ...located(tag),
            action: absolute(tag.attribs.action, base),
            hasPassword: $(tag).find(password).length > 0,
        })),
        hasLonePassword: inDocument(password).some(
            (input) => $(input).closest('form').length === 0,
        ),
        viewport:
            metas.find(({ keys }) => keys[0] === 'viewport')?.content ?? null,
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

const resourceAttributes = [
    { selector: 'script[src]', kind: 'script', attribute: 'src' },
    {
        selector: 'link[rel~="stylesheet" i][href]',
        kind: 'stylesheet',
        attribute: 'href',
    },
    { selector: 'iframe[src]', kind: 'iframe', attribute: 'src' },
    { selector: 'img[src]', kind: 'image', attribute: 'src' },
    { selector: 'img[srcset]', kind: 'image', attribute: 'srcset' },
    { selector: 'source[srcset]', kind: 'image', attribute: 'srcset' },
    { selector: 'source[src]', kind: 'media', attribute: 'src' },
    { selector: 'video[src]', kind: 'media', attribute: 'src' },
    { selector: 'audio[src]', kind: 'media', attribute: 'src' },
    { selector: 'video[poster]', kind: 'image', attribute: 'poster' },
] as const satisfies readonly {
    selector: string;
    kind: ResourceRef['kind'];
    attribute: string;
}[];

const resourceSelector = resourceAttributes
    .map(({ selector }) => selector)
    .join(', ') as cheerio.SelectorType;

const password = 'input[type="password" i]';

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
            .filter((tag) => isInDocument($, tag));
}

function isInDocument($: cheerio.CheerioAPI, tag: Element) {
    return (
        $(tag).parents('html').length > 0 && $(tag).parents('svg').length === 0
    );
}

function srcsetUrls(srcset: string) {
    return srcset
        .split(',')
        .map((candidate) => candidate.trim().split(/\s+/)[0])
        .filter(Boolean);
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

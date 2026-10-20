import { createHash } from 'node:crypto';

import * as cheerio from 'cheerio';
import {
    type AnyNode,
    type Element,
    hasChildren,
    isTag,
    isText,
    type Text,
} from 'domhandler';

import { selectorOf } from '@/features/audit/finding';
import { hidingStyle } from '@/features/audit/hidden';
import { imagesOf, type PageImage } from '@/features/audit/images';
import { simhash } from '@/features/audit/simhash';
import {
    hasArticle,
    type StructuredData,
    structuredData,
} from '@/features/audit/structured-data';
import {
    absolute,
    alternateLinks,
    type HreflangEntry,
    isLandmark,
    mainElement,
    robotsMetaOf,
    spacedText,
} from '@/features/crawl/html';
import { jsonLdBlocks } from '@/features/crawl/signals';

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

export interface JsonLdBlock extends PageElement {
    value: unknown;
    error: string | null;
}

export interface PageForm extends PageElement {
    action: string | null;
    hasPassword: boolean;
}

export interface AnsweredText {
    text: string;
    isAnswered: boolean;
}

export interface MainHeading extends AnsweredText {
    level: number;
}

export interface MainContent {
    isLandmark: boolean;
    words: number;
    h1: { wordsBefore: number; wordsThrough: number } | null;
    paragraphs: { words: number; wordsBefore: number }[];
    headings: MainHeading[];
    bold: AnsweredText[];
    terms: string[];
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
    siteName: string | null;
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
    bingbotMeta: string[];
    refresh: string | null;
    alternateTags: AlternateTag[];
    jsonLd: JsonLdBlock[];
    structuredData: StructuredData;
    isArticle: boolean;
    hasMicrodata: boolean;
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
    mainContent: MainContent;
    nosnippet: string | null;
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

    const jsonLd = jsonLdBlocks($).map(({ element, value, error }) => ({
        ...located(element),
        value,
        error,
    }));

    const data = structuredData(jsonLd);
    const h1Tags = inDocument('h1');

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
        h1s: h1Tags.map((tag) => {
            const text = spacedText([tag]);

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
            text: spacedText([tag]),
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
        siteName: ogContents('og:site_name')[0] ?? null,
        modifiedTime:
            metas.find(({ keys }) => keys.includes('article:modified_time'))
                ?.content || null,
        plugins: inDocument('frame, frameset, applet, object, embed')
            .filter(isPlugin)
            .map((tag) => ({ ...located(tag), name: tag.name })),
        visibleText: textsOf(body.toArray())
            .map((node) => node.data)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim(),
        markupLength: html.replace(scriptOrStyle, '').length,
        elementCount: inDocument('*' as cheerio.SelectorType).length,
        images: imagesOf($, base),
        lang: $('html').attr('lang')?.trim().toLowerCase() || null,
        canonical: absolute(canonicals[0]?.href, base),
        canonicals,
        robotsMeta: robotsMetaOf($),
        bingbotMeta: robotsMetaOf($, 'bingbot'),
        refresh: refresh ? ($(refresh).attr('content') ?? '') : null,
        alternateTags,
        jsonLd,
        structuredData: data,
        isArticle:
            hasArticle(data) ||
            (jsonLd.length === 0 &&
                ogContents('og:type')[0]?.toLowerCase() === 'article'),
        hasMicrodata: $('[itemscope], [typeof], [vocab]').length > 0,
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

    const main = mainElement($);

    const around =
        main && (main.is(nosnippet) ? main : main.parents(nosnippet)).last()[0];

    const mainText = spacedText(main?.toArray() ?? []);

    return {
        ...page,
        mainText,
        mainContent: mainContentOf(main, h1Tags[0]),
        nosnippet: mainText && around ? selectorOf(around) : null,
        bodyHash: mainText
            ? createHash('sha256').update(mainText).digest('hex')
            : null,
        simhash: simhash(mainText),
        wordCount: mainText ? mainText.split(' ').length : 0,
    };
}

export function srcsetUrls(srcset: string) {
    const urls: string[] = [];
    let index = 0;

    for (;;) {
        candidateUrl.lastIndex = index;

        const [separatorsAndUrl, url] = candidateUrl.exec(srcset)!;

        index += separatorsAndUrl.length;

        if (url === '') {
            return urls;
        }

        const bare = url.replace(/,+$/, '');

        if (bare !== url) {
            urls.push(bare);

            continue;
        }

        const { descriptors, end } = descriptorsOf(srcset, index);

        index = end;

        if (hasValidDescriptors(descriptors)) {
            urls.push(url);
        }
    }
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

const candidateUrl = /[\t\n\f\r ,]*([^\t\n\f\r ]*)/y;

const asciiWhitespace = /[\t\n\f\r ]/;

const floatingPoint = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;

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

const nosnippet =
    'span[data-nosnippet], div[data-nosnippet], section[data-nosnippet]';

const scriptOrStyle = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const headingNames = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const blockNames = new Set([
    ...headingNames,
    'p',
    'strong',
    'b',
    'summary',
    'dt',
]);

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

function descriptorsOf(srcset: string, start: number) {
    const descriptors: string[] = [];
    let descriptor = '';
    let isInParens = false;
    let index = start;

    for (; index < srcset.length; index++) {
        const char = srcset[index];

        if (!isInParens && char === ',') {
            index += 1;

            break;
        }

        if (!isInParens && asciiWhitespace.test(char)) {
            descriptors.push(descriptor);
            descriptor = '';
        } else {
            descriptor += char;
            isInParens = isInParens ? char !== ')' : char === '(';
        }
    }

    return {
        descriptors: [...descriptors, descriptor].filter(Boolean),
        end: index,
    };
}

function hasValidDescriptors(descriptors: string[]) {
    const kinds = new Set<string>();

    for (const descriptor of descriptors) {
        const kind = descriptor.slice(-1);
        const value = descriptor.slice(0, -1);

        const isValid =
            kind === 'x'
                ? floatingPoint.test(value) && Number(value) >= 0
                : (kind === 'w' || kind === 'h') &&
                  /^\d+$/.test(value) &&
                  Number(value) > 0;

        if (!isValid || kinds.has(kind)) {
            return false;
        }

        kinds.add(kind);
    }

    return kinds.has('x')
        ? kinds.size === 1
        : !kinds.has('h') || kinds.has('w');
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
            const text = spacedText([element]);

            return {
                selector: selectorOf(element),
                snippet: $.html(element),
                words: text ? text.split(' ').length : 0,
                text,
            };
        })
        .filter(({ words }) => words >= hiddenBlockWords);
}

function textsOf(nodes: AnyNode[]): Text[] {
    return nodes.flatMap((node) => {
        if (isText(node)) {
            return [node];
        }

        return hasChildren(node) ? textsOf(node.children) : [];
    });
}

function blocksOf(nodes: AnyNode[], blocks: Element[] = []) {
    for (const node of nodes) {
        if (isTag(node) && blockNames.has(node.name)) {
            blocks.push(node);
        }

        if (hasChildren(node)) {
            blocksOf(node.children, blocks);
        }
    }

    return blocks;
}

function mainContentOf(
    main: cheerio.Cheerio<Element> | undefined,
    h1: Element | undefined,
): MainContent {
    const words = textsOf(main?.toArray() ?? [])
        .flatMap((node) =>
            node.data
                .split(/\s+/)
                .filter(Boolean)
                .map(() => node.startIndex ?? 0),
        )
        .sort((one, other) => one - other);

    const wordsBefore = (index: number) => {
        let low = 0;
        let high = words.length;

        while (low < high) {
            const middle = (low + high) >> 1;

            if (words[middle] < index) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }

        return low;
    };

    const blocks = blocksOf(main?.[0]?.children ?? []).map((element) => ({
        element,
        text: spacedText([element]),
    }));

    const isAnswered = (index: number) => {
        for (let next = index + 1; next < blocks.length; next++) {
            const { element, text } = blocks[next];

            if (headingNames.has(element.name)) {
                return false;
            }

            if (element.name === 'p' && text) {
                return true;
            }
        }

        return false;
    };

    return {
        isLandmark: main ? isLandmark(main) : false,
        words: words.length,
        h1: h1
            ? {
                  wordsBefore: wordsBefore(h1.startIndex ?? 0),
                  wordsThrough: wordsBefore(h1.endIndex ?? 0),
              }
            : null,
        paragraphs: blocks
            .filter(({ element }) => element.name === 'p')
            .map(({ element }) => ({
                words:
                    wordsBefore(element.endIndex ?? 0) -
                    wordsBefore(element.startIndex ?? 0),
                wordsBefore: wordsBefore(element.startIndex ?? 0),
            })),
        headings: blocks.flatMap(({ element, text }, index) =>
            headingNames.has(element.name)
                ? [
                      {
                          level: Number(element.name.slice(1)),
                          text,
                          isAnswered: isAnswered(index),
                      },
                  ]
                : [],
        ),
        bold: blocks.flatMap(({ element, text }, index) =>
            element.name === 'strong' || element.name === 'b'
                ? [{ text, isAnswered: isAnswered(index) }]
                : [],
        ),
        terms: blocks
            .filter(
                ({ element }) =>
                    element.name === 'summary' || element.name === 'dt',
            )
            .map(({ text }) => text),
    };
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

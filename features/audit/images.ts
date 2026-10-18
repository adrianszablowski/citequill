import { createHash } from 'node:crypto';

import type * as cheerio from 'cheerio';
import type { Element, ParentNode } from 'domhandler';

import { selectorOf } from '@/features/audit/finding';
import { absolute } from '@/features/crawl/html';

export interface PageImage {
    tag: string;
    src: string | null;
    subject: string | null;
    hasSrc: boolean;
    alt: string | null;
    hasGeneratorMarker: boolean;
    role: string | null;
    title: string;
    isNamed: boolean;
    isDecorative: boolean;
    hasTabindex: boolean;
    hasSvgTitle: boolean;
    isInPicture: boolean;
    ancestor: 'link' | 'figure' | null;
    linkText: string | null;
    width: string | null;
    height: string | null;
    hasAspectRatio: boolean;
    selector: string;
    snippet: string;
}

export const generatorMarker = 'generator-unable-to-provide-required-alt';

export function imagesOf($: cheerio.CheerioAPI, base: URL): PageImage[] {
    return $('img, svg, [role]')
        .toArray()
        .filter((element) => isListed(element))
        .map((element) => {
            const { name, attribs } = element;
            const style = inlineStyle(attribs.style);
            const link = $(element).closest('a');
            const role = attribs.role?.trim().toLowerCase() || null;
            const alt = attribs.alt ?? null;
            const figure = $(element).parent('figure');
            const others = figure.children().not('figcaption');
            const src = absolute(attribs.src, base);
            const openingTag = openingTagOf(element);

            const isFigureSole =
                figure.children('figcaption').length > 0 &&
                others.length === 1 &&
                others.get(0) === element;

            return {
                tag: name,
                src,
                subject:
                    name === 'img'
                        ? src
                        : inlineSubject($, element, openingTag),
                hasSrc: Boolean(attribs.src?.trim()),
                alt,
                hasGeneratorMarker: generatorMarker in attribs,
                role,
                title: attribs.title?.trim() ?? '',
                isNamed: Boolean(
                    attribs['aria-label']?.trim() ||
                    attribs['aria-labelledby']?.trim(),
                ),
                isDecorative:
                    alt === '' || role === 'presentation' || role === 'none',
                hasTabindex: 'tabindex' in attribs,
                hasSvgTitle:
                    name === 'svg' &&
                    $(element).children().first().get(0)?.name === 'title',
                isInPicture: $(element).parent('picture').length > 0,
                ancestor: ancestorOf(isFigureSole, link.length > 0),
                linkText:
                    link.length > 0
                        ? link.text().replace(/\s+/g, ' ').trim().toLowerCase()
                        : null,
                width: attribs.width ?? null,
                height: attribs.height ?? null,
                hasAspectRatio: style.includes('aspect-ratio:'),
                selector: selectorOf(element),
                snippet: name === 'img' ? $.html(element) : openingTag,
            };
        });
}

function inlineSubject(
    $: cheerio.CheerioAPI,
    element: Element,
    openingTag: string,
) {
    const use = $(element).children('use').first();
    const href = (use.attr('href') ?? use.attr('xlink:href'))?.trim();

    return (
        href ||
        createHash('sha256')
            .update(openingTag + $(element).text())
            .digest('hex')
            .slice(0, 16)
    );
}

function openingTagOf({ name, attribs }: Element) {
    const attributes = Object.entries(attribs).map(
        ([key, value]) =>
            ` ${key}="${value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`,
    );

    return `<${name}${attributes.join('')}>`;
}

function ancestorOf(isFigureSole: boolean, isInLink: boolean) {
    if (isFigureSole) {
        return 'figure';
    }

    return isInLink ? 'link' : null;
}

const hiddenStyles = ['display:none', 'visibility:hidden'];

function isListed(element: Element) {
    const role = element.attribs.role?.trim().toLowerCase();

    const isImage =
        element.name === 'img' ||
        (!isInSvg(element) && (element.name === 'svg' || role === 'img'));

    return isImage && !isHidden(element) && !isPixel(element);
}

function isInSvg(element: Element) {
    for (let node = element.parent; node; node = node.parent) {
        if ('name' in node && node.name === 'svg') {
            return true;
        }
    }

    return false;
}

function isHidden(element: Element) {
    for (let node: ParentNode | null = element; node; node = node.parent) {
        if (!('attribs' in node)) {
            continue;
        }

        const { name, attribs } = node;
        const style = inlineStyle(attribs.style);

        if (
            name === 'template' ||
            attribs['aria-hidden']?.trim().toLowerCase() === 'true' ||
            hiddenStyles.some((hidden) => style.includes(hidden))
        ) {
            return true;
        }
    }

    return false;
}

function isPixel({ name, attribs }: Element) {
    const isTiny = (value: string | undefined) =>
        Number.parseFloat(value ?? '') <= 1;

    return (
        name === 'img' &&
        attribs.alt === '' &&
        isTiny(attribs.width) &&
        isTiny(attribs.height)
    );
}

function inlineStyle(style: string | undefined) {
    return (style ?? '').toLowerCase().replace(/\s+/g, '');
}

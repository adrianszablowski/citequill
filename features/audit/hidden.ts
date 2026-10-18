import type { Element, ParentNode } from 'domhandler';

export type HidingStyle = 'none' | 'offscreen';

export function hidingStyle(style: string | undefined): HidingStyle | null {
    const inline = inlineStyle(style);

    if (
        inline.includes('display:none') ||
        inline.includes('visibility:hidden')
    ) {
        return 'none';
    }

    const isOffset = offscreenProperties.some((property) => {
        const value = new RegExp(`(?:^|;)${property}:(-[\\d.]+)px`).exec(
            inline,
        )?.[1];

        return value !== undefined && Number(value) <= offscreenPx;
    });

    return isOffset || zeroSizeOrOpacity.test(inline) ? 'offscreen' : null;
}

export function isHidden(element: Element) {
    for (let node: ParentNode | null = element; node; node = node.parent) {
        if (!('attribs' in node)) {
            continue;
        }

        const { name, attribs } = node;

        if (
            name === 'template' ||
            attribs['aria-hidden']?.trim().toLowerCase() === 'true' ||
            hidingStyle(attribs.style) === 'none'
        ) {
            return true;
        }
    }

    return false;
}

export function inlineStyle(style: string | undefined) {
    return (style ?? '').toLowerCase().replace(/\s+/g, '');
}

const offscreenPx = -9999;

const offscreenProperties = ['text-indent', 'left'];

const zeroSizeOrOpacity =
    /(?:^|;)(?:font-size:0(?:px|em|rem|%)?|opacity:0(?:\.0+)?)(?=;|!|$)/;

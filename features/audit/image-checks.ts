import { type Finding, snippetOf } from '@/features/audit/finding';
import { generatorMarker, type PageImage } from '@/features/audit/images';
import { repeatedWord } from '@/features/audit/on-page-checks';

export type AltState = 'absent' | 'empty' | 'whitespace';

export const altMaxLength = 100;

export const altStuffedTerms = 4;

export function imageChecks(url: string, images: PageImage[]): Finding[] {
    return images.flatMap((image) =>
        verdicts(image).map((check) => ({
            check,
            url,
            subject: image.subject,
            selector: image.selector,
            snippet: image.snippet,
            detail: {
                alt: altAsFound(image.alt),
                ancestor: image.ancestor,
                width: image.width,
                height: image.height,
            },
        })),
    );
}

const stockAlts = new Set(['image', 'picture', 'logo']);

const genericFile =
    /^(img_|dsc|dcim|pxl_|screenshot|screen shot|image|photo|untitled)[\s_-]*\d/i;

function verdicts(image: PageImage): Finding['check'][] {
    if (image.tag === 'svg') {
        return [
            ...(image.role === 'img' && !image.hasSvgTitle && !image.isNamed
                ? ['svg-no-name' as const]
                : []),
            ...(image.role === null ? ['svg-no-role' as const] : []),
        ];
    }

    if (image.tag !== 'img') {
        return image.isNamed || image.title ? [] : ['icon-no-name'];
    }

    const hasDimensions =
        Boolean(image.width?.trim() && image.height?.trim()) ||
        image.hasAspectRatio;

    return [
        ...(image.isInPicture && !image.hasSrc
            ? ['picture-no-src' as const]
            : []),
        ...(hasDimensions ? [] : ['img-no-dimensions' as const]),
        ...altVerdicts(image),
        ...(image.alt?.trim() && genericFile.test(fileName(image.src) ?? '')
            ? ['img-filename-generic' as const]
            : []),
    ];
}

function altVerdicts(image: PageImage): Finding['check'][] {
    const { alt } = image;

    if (image.isDecorative) {
        return [
            ...(image.hasTabindex ? ['img-decorative-focusable' as const] : []),
            ...(alt === '' && image.title
                ? ['img-decorative-title' as const]
                : []),
        ];
    }

    if (alt === null) {
        if (image.isNamed) {
            return [];
        }

        if (image.hasGeneratorMarker) {
            return ['img-generator-blank'];
        }

        if (image.title) {
            return ['img-title-only'];
        }

        return image.ancestor === 'figure'
            ? ['img-figure-no-alt']
            : ['img-alt-missing'];
    }

    const text = alt.replace(/\s+/g, ' ').trim();

    if (!text) {
        return ['img-alt-whitespace'];
    }

    if (text === generatorMarker) {
        return ['img-generator-blank'];
    }

    const name = fileName(image.src);
    const lower = text.toLowerCase();

    const isFileName =
        stockAlts.has(lower) ||
        (name !== null &&
            (lower === name || lower === name.replace(/\.[^.]+$/, '')));

    return [
        ...(isFileName ? ['img-alt-filename' as const] : []),
        ...([...text].length > altMaxLength ? ['img-alt-long' as const] : []),
        ...(repeatedWord(text) ||
        text.split(',').filter((term) => term.trim()).length >= altStuffedTerms
            ? ['img-alt-stuffed' as const]
            : []),
        ...(image.linkText === lower ? ['img-alt-redundant' as const] : []),
    ];
}

function altAsFound(alt: string | null) {
    if (alt === null) {
        return 'absent' satisfies AltState;
    }

    if (alt === '') {
        return 'empty' satisfies AltState;
    }

    return alt.trim() ? snippetOf(alt) : ('whitespace' satisfies AltState);
}

function fileName(src: string | null) {
    if (!src) {
        return null;
    }

    const last = new URL(src).pathname.split('/').pop() ?? '';

    try {
        return decodeURIComponent(last).toLowerCase() || null;
    } catch {
        return last.toLowerCase() || null;
    }
}

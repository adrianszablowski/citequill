import { isWebUrl } from '@/lib/utils';

export const genericAnchors = new Set([
    'click here',
    'here',
    'read more',
    'more',
    'learn more',
    'link',
    'this',
    'this page',
    'continue',
    'kliknij tutaj',
    'tutaj',
    'tu',
    'czytaj więcej',
    'więcej',
    'dowiedz się więcej',
    'zobacz więcej',
    'czytaj dalej',
]);

export function isGenericAnchor(text: string) {
    const label = text.trim();

    return (
        genericAnchors.has(comparable(label)) ||
        isWebUrl(label) ||
        label.toLowerCase().startsWith('www.')
    );
}

function comparable(text: string) {
    return text
        .toLowerCase()
        .replace(/[\p{P}\p{S}]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

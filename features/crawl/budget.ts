import type { Signals } from '@/features/crawl/signals';

export const perPageChars = 12_000;

export const chunkChars = 60_000;

export const totalChars = 500_000;

export const readerChars = 4_000;

export const readerHeading = 'Page as readers see it';

export interface PageText {
    url: string;
    title: string | null;
    body: string | null;
    readerBody: string | null;
    signals: Signals | null;
}

export function pageChunks(
    pages: PageText[],
    perPage = perPageChars,
    chunk = chunkChars,
    total = totalChars,
) {
    const chunks: PageText[][] = [];
    let current: PageText[] = [];
    let currentSize = 0;
    let used = 0;

    for (const page of pages) {
        const size = pageText(page, perPage).length;

        if (used + size > total) {
            break;
        }

        if (currentSize + size > chunk && current.length > 0) {
            chunks.push(current);
            current = [];
            currentSize = 0;
        }

        current.push(page);
        currentSize += size;
        used += size;
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
}

export function chunkText(pages: PageText[], perPage = perPageChars) {
    return pages.map((page) => pageText(page, perPage)).join('\n\n---\n\n');
}

export function pageText(
    page: PageText,
    perPage = perPageChars,
    reader = readerChars,
) {
    const body = (page.body ?? '').slice(0, perPage);

    const readerBody = page.readerBody
        ? `${readerHeading}:\n${page.readerBody.slice(0, reader)}`
        : '';

    return [
        `## ${page.url}`,
        page.title ?? '',
        signalsText(page.signals),
        body,
        readerBody,
    ]
        .filter(Boolean)
        .join('\n\n')
        .trim();
}

function signalsText(signals: Signals | null) {
    if (!signals) {
        return '';
    }

    const lines = [
        line('Description', signals.description),
        line('Site name', signals.siteName),
        line('OG title', signals.ogTitle),
        line('OG description', signals.ogDescription),
        line('Canonical', signals.canonical),
        line('Emails', signals.emails.join(', ')),
        line('Phones', signals.phones.join(', ')),
        line('Social profiles', signals.socialLinks.join(', ')),
        line('Footer', signals.footer),
        line(
            'JSON-LD',
            signals.jsonLd.length > 0 ? JSON.stringify(signals.jsonLd) : '',
        ),
    ].filter(Boolean);

    return lines.length > 0 ? `Page data:\n${lines.join('\n')}` : '';
}

function line(label: string, value: string | null) {
    return value ? `- ${label}: ${value}` : '';
}

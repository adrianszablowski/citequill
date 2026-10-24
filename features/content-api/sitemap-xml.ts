import type { sitemapItem } from '@/features/content-api/page-object';

export type SitemapItem = ReturnType<typeof sitemapItem>;

export const sitemapLimits = { bytes: 4_000_000, urls: 50_000 };

export function sitemapFiles(items: SitemapItem[], limits = sitemapLimits) {
    const files: string[][] = [[]];
    let size = urlsetBytes;

    for (const entry of items.map(urlEntry)) {
        const bytes = Buffer.byteLength(entry);
        const current = files[files.length - 1];

        if (
            current.length > 0 &&
            (current.length >= limits.urls || size + bytes > limits.bytes)
        ) {
            files.push([entry]);
            size = urlsetBytes + bytes;
        } else {
            current.push(entry);
            size += bytes;
        }
    }

    return files.map(urlset);
}

export function sitemapIndex(urls: string[]) {
    const entries = urls.map(
        (url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>\n`,
    );

    return `${declaration}<sitemapindex xmlns="${sitemapNamespace}">\n${entries.join('')}</sitemapindex>\n`;
}

export function escapeXml(value: string) {
    return value.replace(/[&<>"']/g, (character) => entities[character]);
}

function urlEntry(item: SitemapItem) {
    const links = item.alternates.map(
        (alternate) =>
            `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hreflang)}" href="${escapeXml(alternate.url)}"/>`,
    );

    return `<url><loc>${escapeXml(item.url)}</loc><lastmod>${item.lastmod}</lastmod>${links.join('')}</url>\n`;
}

function urlset(entries: string[]) {
    return `${urlsetOpen}${entries.join('')}${urlsetClose}`;
}

const declaration = '<?xml version="1.0" encoding="UTF-8"?>\n';

const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';

const urlsetOpen = `${declaration}<urlset xmlns="${sitemapNamespace}" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

const urlsetClose = '</urlset>\n';

const urlsetBytes = Buffer.byteLength(urlsetOpen + urlsetClose);

const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
};

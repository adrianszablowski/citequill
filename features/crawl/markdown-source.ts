import { linkHeaderEntries } from '@/features/audit/observe';

export function markdownUrlFor(
    url: string,
    headers: Headers,
    llmsLinks: string[],
) {
    const fromHeader = headerMarkdownLink(headers.get('link'));

    if (fromHeader) {
        return new URL(fromHeader, url).href;
    }

    const bare = url.replace(/\/$/, '');
    const candidates = new Set([`${bare}.md`, `${bare}/index.md`]);

    return llmsLinks.find((link) => candidates.has(link)) ?? null;
}

export function headerMarkdownLink(header: string | null) {
    return (
        linkHeaderEntries(header).find(
            ({ href, rel, type }) =>
                href !== '' &&
                rel.includes('alternate') &&
                isMarkdownType(type),
        )?.href ?? null
    );
}

export function isMarkdownType(contentType: string | null) {
    return (
        (contentType ?? '').split(';')[0].trim().toLowerCase() ===
        'text/markdown'
    );
}

export function pageBodies(readerMarkdown: string, alternate: string | null) {
    return alternate
        ? { body: alternate, readerBody: readerMarkdown }
        : { body: readerMarkdown, readerBody: null };
}

export function linksFromLlmsText(text: string, base: string) {
    const links: string[] = [];

    for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        try {
            links.push(new URL(href, base).href);
        } catch {
            continue;
        }
    }

    return links;
}

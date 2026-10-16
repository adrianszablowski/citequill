export function markdownUrlFor(
    url: string,
    headers: Headers,
    llmsLinks: string[],
) {
    const fromHeader = headers
        .get('link')
        ?.split(',')
        .map((part) => part.trim())
        .find(
            (part) =>
                /rel="?alternate"?/i.test(part) &&
                /type="?text\/markdown"?/i.test(part),
        )
        ?.match(/<([^>]+)>/)?.[1];

    if (fromHeader) {
        return new URL(fromHeader, url).href;
    }

    const bare = url.replace(/\/$/, '');
    const candidates = new Set([`${bare}.md`, `${bare}/index.md`]);

    return llmsLinks.find((link) => candidates.has(link)) ?? null;
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

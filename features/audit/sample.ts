export const topLevelPages = 10;

export const variantPaths = 20;

export function variantSample(urls: string[], homes: string[]) {
    return samplePages([...urls].sort(), homes, homes.length + variantPaths);
}

export function samplePages(urls: string[], homes: string[], limit: number) {
    const homeUrls = new Set(homes.map((home) => new URL(home).href));
    const others = urls.filter((url) => !homeUrls.has(url));
    const isTopLevel = (url: string) => segmentsOf(url).length <= 1;

    const sample = [
        ...urls.filter((url) => homeUrls.has(url)),
        ...others.filter(isTopLevel).slice(0, topLevelPages),
    ];

    const patterns = new Set<string>();

    for (const url of others.filter((other) => !isTopLevel(other))) {
        const pattern = urlPattern(url);

        if (!patterns.has(pattern)) {
            patterns.add(pattern);
            sample.push(url);
        }
    }

    return sample.slice(0, limit);
}

export function urlPattern(url: string) {
    const segments = segmentsOf(url).map((segment) =>
        identifier.test(segment) ? placeholder : segment.toLowerCase(),
    );

    return `${segments[0] ?? ''}/${segments.length}`;
}

const placeholder = ':id';

const identifier =
    /^(?:\d+|[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}|\d{4}-\d{2}(?:-\d{2})?)$/i;

function segmentsOf(url: string) {
    return new URL(url).pathname.split('/').filter(Boolean);
}

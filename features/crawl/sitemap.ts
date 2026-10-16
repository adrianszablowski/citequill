import { XMLParser } from 'fast-xml-parser';

export function sitemapsFromRobots(robots: string) {
    return robots
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^sitemap:/i.test(line))
        .map((line) => line.slice('sitemap:'.length).trim())
        .filter(isHttpUrl);
}

export function sitemapEntries(xml: string) {
    const parsed = parser.parse(xml) as {
        urlset?: { url?: Entry | Entry[] };
        sitemapindex?: { sitemap?: Entry | Entry[] };
    };

    return {
        pages: locations(parsed.urlset?.url),
        sitemaps: locations(parsed.sitemapindex?.sitemap),
    };
}

interface Entry {
    loc?: string | number;
}

const parser = new XMLParser();

function locations(entries: Entry | Entry[] | undefined) {
    return [entries]
        .flat()
        .map((entry) => String(entry?.loc ?? '').trim())
        .filter(isHttpUrl);
}

function isHttpUrl(value: string) {
    return /^https?:\/\//i.test(value);
}

import type { Tables } from '@/lib/types/database';

export type QueueEntry = Omit<Tables<'audit_queue'>, 'audit_id'>;

export type Queue = ReadonlyMap<string, QueueEntry>;

export interface Candidate {
    url: string;
    depth: number | null;
    inSitemap?: boolean;
    inbound?: number;
}

export const queueCap = 5_000;

export const queryUrlsPerPath = 50;

export const batchSize = 50;

export function siteHosts(domain: string, baseUrls: string[]) {
    const hosts = [domain, ...baseUrls.map((url) => new URL(url).hostname)];

    return [
        ...new Set(
            hosts.flatMap((host) => [
                host,
                host.startsWith('www.') ? host.slice(4) : `www.${host}`,
            ]),
        ),
    ];
}

export function siteBaseUrls(domain: string, locales: { base_url: string }[]) {
    return locales.length > 0
        ? locales.map((locale) => locale.base_url)
        : [`https://${domain}`];
}

export function homePages(baseUrls: string[]) {
    return [...new Set(baseUrls.map((url) => new URL(url).href))];
}

export function siteOrigins(hosts: string[]) {
    return schemes.flatMap((scheme) =>
        hosts.map((host) => `${scheme}//${host}`),
    );
}

export function linkTarget(href: string, hosts: string[]) {
    try {
        const url = new URL(href);

        if (!schemes.includes(url.protocol) || !hosts.includes(url.hostname)) {
            return null;
        }

        url.hash = '';

        return url.href;
    } catch {
        return null;
    }
}

export function linkDepth(depth: number | null) {
    return depth === null ? null : depth + 1;
}

export function addToQueue(queue: Queue, candidates: Candidate[]) {
    const next = new Map(queue);
    const touched = new Set<string>();
    const queried = queryCounts([...next.keys()]);
    let isCapped = false;

    for (const { url, depth, inSitemap = false, inbound = 0 } of candidates) {
        const known = next.get(url);

        if (known) {
            const updated = {
                ...known,
                depth:
                    known.state === 'queued'
                        ? shallower(known.depth, depth)
                        : known.depth,
                in_sitemap: known.in_sitemap || inSitemap,
                inbound_links: known.inbound_links + inbound,
            };

            if (
                updated.depth !== known.depth ||
                updated.in_sitemap !== known.in_sitemap ||
                updated.inbound_links !== known.inbound_links
            ) {
                next.set(url, updated);
                touched.add(url);
            }

            continue;
        }

        if (next.size >= queueCap) {
            isCapped = true;

            continue;
        }

        const path = queryPath(url);

        if (path) {
            const count = queried.get(path) ?? 0;

            if (count >= queryUrlsPerPath) {
                continue;
            }

            queried.set(path, count + 1);
        }

        next.set(url, {
            url,
            depth,
            state: 'queued',
            in_sitemap: inSitemap,
            inbound_links: inbound,
        });

        touched.add(url);
    }

    return { queue: next, touched: [...touched], isCapped };
}

export function nextBatch(queue: Queue) {
    const queued = [...queue.values()]
        .filter((entry) => entry.state === 'queued')
        .sort(
            (a, b) =>
                rank(a.depth) - rank(b.depth) || a.url.localeCompare(b.url),
        );

    return queued
        .filter((entry) => entry.depth === queued[0].depth)
        .slice(0, batchSize);
}

const schemes = ['https:', 'http:'];

function rank(depth: number | null) {
    return depth ?? Number.POSITIVE_INFINITY;
}

function shallower(a: number | null, b: number | null) {
    if (a === null || b === null) {
        return a ?? b;
    }

    return Math.min(a, b);
}

function queryPath(href: string) {
    const url = new URL(href);

    return url.search ? `${url.origin}${url.pathname}` : null;
}

function queryCounts(urls: string[]) {
    const counts = new Map<string, number>();

    for (const path of urls.map(queryPath)) {
        if (path) {
            counts.set(path, (counts.get(path) ?? 0) + 1);
        }
    }

    return counts;
}

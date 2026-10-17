import { describe, expect, it } from 'vitest';

import {
    addToQueue,
    batchSize,
    homePages,
    linkDepth,
    linkTarget,
    nextBatch,
    type Queue,
    queueCap,
    queryUrlsPerPath,
    siteBaseUrls,
    siteHosts,
    siteOrigins,
} from '@/features/audit/queue';

const hosts = siteHosts('acme.com', ['https://acme.com', 'https://acme.de']);

describe('siteHosts', () => {
    it('holds every locale host with its www twin', () => {
        expect(hosts).toEqual([
            'acme.com',
            'www.acme.com',
            'acme.de',
            'www.acme.de',
        ]);
    });
});

describe('homePages', () => {
    it("is the home page of every locale's base URL, once each, or of the domain when the project has no locales", () => {
        expect(
            homePages(
                siteBaseUrls('acme.com', [
                    { base_url: 'https://acme.com' },
                    { base_url: 'https://acme.com/' },
                    { base_url: 'https://acme.com/de' },
                ]),
            ),
        ).toEqual(['https://acme.com/', 'https://acme.com/de']);

        expect(homePages(siteBaseUrls('acme.com', []))).toEqual([
            'https://acme.com/',
        ]);
    });
});

describe('siteOrigins', () => {
    it('names the origin of every URL the queue admits, each host over https and http', () => {
        const origins = siteOrigins(hosts);

        for (const href of [
            'https://acme.com/a',
            'http://acme.com/a',
            'https://www.acme.com/a',
            'http://www.acme.de/b',
        ]) {
            expect(origins).toContain(new URL(linkTarget(href, hosts)!).origin);
        }

        expect(origins).toHaveLength(hosts.length * 2);
    });
});

describe('linkTarget', () => {
    it('keeps links on the site hosts, every locale included, and drops the fragment', () => {
        expect(linkTarget('https://acme.de/preise#plans', hosts)).toBe(
            'https://acme.de/preise',
        );

        expect(linkTarget('https://www.acme.com/a?b=1', hosts)).toBe(
            'https://www.acme.com/a?b=1',
        );
    });

    it('drops other hosts, subdomains and schemes that are not http', () => {
        expect(linkTarget('https://other.com/', hosts)).toBeNull();
        expect(linkTarget('https://blog.acme.com/', hosts)).toBeNull();
        expect(linkTarget('mailto:hi@acme.com', hosts)).toBeNull();
        expect(linkTarget('not a url', hosts)).toBeNull();
    });

    it('keeps host, trailing slash and case variants apart', () => {
        const variants = [
            'https://acme.com/About',
            'https://acme.com/about',
            'https://acme.com/about/',
            'https://www.acme.com/about',
        ].map((href) => linkTarget(href, hosts));

        expect(new Set(variants).size).toBe(4);
    });
});

describe('addToQueue', () => {
    it('adds a new URL once, counts every page linking to it and keeps the shallowest depth', () => {
        const seeded = addToQueue(new Map(), [
            { url: 'https://acme.com/', depth: 0 },
            { url: 'https://acme.com/a', depth: null, inSitemap: true },
        ]).queue;

        const { queue, touched } = addToQueue(seeded, [
            { url: 'https://acme.com/a', depth: 1, inbound: 1 },
            { url: 'https://acme.com/a', depth: 2, inbound: 1 },
            { url: 'https://acme.com/b', depth: 1, inbound: 1 },
        ]);

        expect(queue.get('https://acme.com/a')).toEqual({
            url: 'https://acme.com/a',
            depth: 1,
            state: 'queued',
            in_sitemap: true,
            inbound_links: 2,
        });

        expect(touched).toEqual(['https://acme.com/a', 'https://acme.com/b']);
    });

    it('reads at most 50 URLs with a query string per path', () => {
        const candidates = Array.from(
            { length: queryUrlsPerPath + 5 },
            (_, i) => ({
                url: `https://acme.com/shop?page=${i}`,
                depth: 1,
            }),
        );

        const { queue } = addToQueue(new Map(), [
            ...candidates,
            { url: 'https://acme.com/shop', depth: 1 },
            { url: 'https://acme.com/blog?page=2', depth: 1 },
        ]);

        const shop = [...queue.keys()].filter((url) =>
            url.startsWith('https://acme.com/shop?'),
        );

        expect(shop).toHaveLength(queryUrlsPerPath);
        expect(queue.has('https://acme.com/shop')).toBe(true);
        expect(queue.has('https://acme.com/blog?page=2')).toBe(true);
    });

    it('stops at 5 000 URLs and says so', () => {
        const full: Queue = new Map(
            Array.from({ length: queueCap }, (_, i) => [
                `https://acme.com/p${i}`,
                {
                    url: `https://acme.com/p${i}`,
                    depth: 1,
                    state: 'queued' as const,
                    in_sitemap: false,
                    inbound_links: 0,
                },
            ]),
        );

        const result = addToQueue(full, [
            { url: 'https://acme.com/p1', depth: 1, inbound: 1 },
            { url: 'https://acme.com/new', depth: 1 },
        ]);

        expect(result.queue.size).toBe(queueCap);
        expect(result.queue.get('https://acme.com/p1')?.inbound_links).toBe(1);
        expect(result.isCapped).toBe(true);
    });
});

describe('nextBatch', () => {
    it('reads breadth first: one depth at a time, the pages off the click path last', () => {
        const { queue } = addToQueue(new Map(), [
            { url: 'https://acme.com/orphan', depth: null },
            { url: 'https://acme.com/deep', depth: 2 },
            { url: 'https://acme.com/b', depth: 1 },
            { url: 'https://acme.com/a', depth: 1 },
        ]);

        expect(nextBatch(queue).map((entry) => entry.url)).toEqual([
            'https://acme.com/a',
            'https://acme.com/b',
        ]);

        const read = new Map(queue);

        for (const url of [
            'https://acme.com/a',
            'https://acme.com/b',
            'https://acme.com/deep',
        ]) {
            read.set(url, { ...read.get(url)!, state: 'read' });
        }

        expect(nextBatch(read).map((entry) => entry.url)).toEqual([
            'https://acme.com/orphan',
        ]);
    });

    it('takes 50 URLs at most and nothing from an empty queue', () => {
        const { queue } = addToQueue(
            new Map(),
            Array.from({ length: batchSize + 10 }, (_, i) => ({
                url: `https://acme.com/p${i}`,
                depth: 1,
            })),
        );

        expect(nextBatch(queue)).toHaveLength(batchSize);
        expect(nextBatch(new Map())).toEqual([]);
    });

    it('keeps the links of a page off the click path off it', () => {
        expect(linkDepth(2)).toBe(3);
        expect(linkDepth(null)).toBeNull();
    });
});

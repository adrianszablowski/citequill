import { describe, expect, it } from 'vitest';

import {
    addToQueue,
    batchSize,
    homePages,
    isHttpUrl,
    isInternalHost,
    isInternalUrl,
    isSiteUrl,
    isUnderDomain,
    linkDepth,
    linkedFromCap,
    linkTarget,
    nextBatch,
    type Queue,
    queueCap,
    queryUrlsPerPath,
    siteBaseUrls,
    siteHosts,
    siteOrigins,
    withoutSlash,
} from '@/features/audit/queue';

const hosts = siteHosts('acme.com', ['https://acme.com', 'https://acme.de']);

const home = 'https://acme.com/';

const deep = 'https://acme.com/deep';

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

describe('isInternalHost', () => {
    it("holds the site's own hosts and every host under the project's domain, and nothing else", () => {
        expect(isInternalHost('acme.de', hosts, 'acme.com')).toBe(true);

        expect(isInternalHost('cdn.acme.com', hosts, 'www.acme.com')).toBe(
            true,
        );

        expect(isInternalHost('img.shop.acme.com', hosts, 'acme.com')).toBe(
            true,
        );

        expect(isInternalHost('notacme.com', hosts, 'acme.com')).toBe(false);
        expect(isInternalHost('cdn.other.com', hosts, 'acme.com')).toBe(false);
    });

    it("asks the same of a URL's host", () => {
        expect(
            isInternalUrl('https://cdn.acme.com/a.png', hosts, 'acme.com'),
        ).toBe(true);

        expect(
            isInternalUrl('https://other.com/a.png', hosts, 'acme.com'),
        ).toBe(false);
    });

    it("reads the project's domain without its www", () => {
        expect(isUnderDomain('www.acme.com', 'acme.com')).toBe(true);
        expect(isUnderDomain('acme.com', 'www.acme.com')).toBe(false);
    });
});

describe('isSiteUrl', () => {
    it("holds a URL on one of the site's own hosts, and never one under the domain", () => {
        expect(isSiteUrl('https://www.acme.com/a', hosts)).toBe(true);
        expect(isSiteUrl('https://acme.de/b', hosts)).toBe(true);
        expect(isSiteUrl('https://blog.acme.com/c', hosts)).toBe(false);
        expect(isSiteUrl('https://other.com/d', hosts)).toBe(false);
    });
});

describe('isHttpUrl', () => {
    it('holds a URL over http, in any case, and never one over https or another scheme', () => {
        expect(isHttpUrl('http://acme.com/a')).toBe(true);
        expect(isHttpUrl('HTTP://acme.com/a')).toBe(true);
        expect(isHttpUrl('https://acme.com/a')).toBe(false);
        expect(isHttpUrl('ftp://acme.com/a')).toBe(false);
    });
});

describe('withoutSlash', () => {
    it('strips the trailing slashes of a URL it normalises first', () => {
        expect(withoutSlash('https://acme.com/')).toBe('https://acme.com');
        expect(withoutSlash('https://ACME.com/a//')).toBe('https://acme.com/a');
        expect(withoutSlash('https://acme.com/a')).toBe('https://acme.com/a');
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
            { url: 'https://acme.com/a', depth: 1, inbound: 1, from: home },
            { url: 'https://acme.com/a', depth: 2, inbound: 1, from: deep },
            { url: 'https://acme.com/b', depth: 1, inbound: 1, from: home },
        ]);

        expect(queue.get('https://acme.com/a')).toEqual({
            url: 'https://acme.com/a',
            depth: 1,
            state: 'queued',
            in_sitemap: true,
            inbound_links: 2,
            linked_from: [home, deep],
        });

        expect(touched).toEqual(['https://acme.com/a', 'https://acme.com/b']);
    });

    it(`keeps the first ${linkedFromCap} pages linking to a URL, each once, and counts them all`, () => {
        const pages = Array.from(
            { length: linkedFromCap + 2 },
            (_, i) => `https://acme.com/p${i}`,
        );

        const { queue } = addToQueue(new Map(), [
            ...pages.map((from) => ({
                url: 'https://acme.com/t',
                depth: 1,
                inbound: 1,
                from,
            })),
            { url: 'https://acme.com/t', depth: 1, inbound: 1, from: pages[0] },
        ]);

        expect(queue.get('https://acme.com/t')).toMatchObject({
            inbound_links: linkedFromCap + 3,
            linked_from: pages.slice(0, linkedFromCap),
        });
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
                    linked_from: [],
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

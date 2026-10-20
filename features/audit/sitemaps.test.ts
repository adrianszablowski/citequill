import { constants, gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { siteClient } from '@/features/audit/client';
import { firstPace } from '@/features/audit/pacing';
import { siteHosts } from '@/features/audit/queue';
import { readSitemaps, sitemapCap } from '@/features/audit/sitemaps';
import { maxBytes } from '@/features/crawl/fetch';

const hosts = siteHosts('acme.com', ['https://acme.com']);

function site(files: Record<string, string | Uint8Array<ArrayBuffer>>) {
    const calls: string[] = [];

    const client = siteClient({
        botSecret: 's3cret',
        hosts,
        pace: firstPace,
        interval: 1,
        deadline: Date.now() + 60_000,
        deps: {
            fetch: async (input) => {
                const url = String(input);

                calls.push(url);

                return url in files
                    ? new Response(files[url], { status: 200 })
                    : new Response('', { status: 404 });
            },
            lookup: async () => ['93.184.216.34'],
        },
    });

    return {
        calls,
        read: (urls: string[]) => readSitemaps(client, urls, hosts),
    };
}

function index(locs: string[]) {
    return `<sitemapindex>${locs.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join('')}</sitemapindex>`;
}

function urlset(locs: string[]) {
    return `<urlset>${locs.map((loc) => `<url><loc>${loc}</loc></url>`).join('')}</urlset>`;
}

describe('readSitemaps', () => {
    it('follows a sitemap index to its children and reads each file once', async () => {
        const root = 'https://acme.com/sitemap_index.xml';
        const pages = 'https://acme.com/pages.xml';
        const posts = 'https://www.acme.com/posts.xml';

        const { calls, read } = site({
            [root]: index([pages, posts, pages]),
            [pages]: urlset(['https://acme.com/a']),
            [posts]: urlset(['https://www.acme.com/b']),
        });

        const files = await read([root, root]);

        expect(files.map((file) => file.url)).toEqual([root, pages, posts]);
        expect(calls).toEqual([root, pages, posts]);

        expect(
            files.flatMap((file) => file.sitemap.urls.map((url) => url.loc)),
        ).toEqual(['https://acme.com/a', 'https://www.acme.com/b']);
    });

    it(`reads ${sitemapCap} files at most`, async () => {
        const root = 'https://acme.com/sitemap_index.xml';

        const children = Array.from(
            { length: sitemapCap + 10 },
            (_, i) => `https://acme.com/sitemap-${i}.xml`,
        );

        const { calls, read } = site({ [root]: index(children) });

        expect(await read([root])).toHaveLength(sitemapCap);
        expect(calls).toHaveLength(sitemapCap);
    });

    it("reads no sitemap off the site's own hosts", async () => {
        const root = 'https://acme.com/sitemap_index.xml';

        const { calls, read } = site({
            [root]: index(['https://cdn.other.com/sitemap.xml']),
        });

        await read(['https://other.com/sitemap.xml', root]);

        expect(calls).toEqual([root]);
    });

    it('unpacks a gzipped sitemap, reads it past 2 MB and keeps no body', async () => {
        const root = 'https://acme.com/sitemap.xml.gz';

        const locs = Array.from(
            { length: 50_000 },
            (_, i) => `https://acme.com/products/${'p'.repeat(40)}-${i}`,
        );

        const xml = urlset(locs);
        const { read } = site({ [root]: new Uint8Array(gzipSync(xml)) });
        const [file] = await read([root]);

        expect(xml.length).toBeGreaterThan(maxBytes);
        expect(file.sitemap.urls).toHaveLength(locs.length);
        expect(file.sitemap.urls.at(-1)?.loc).toBe(locs.at(-1));

        expect(file.fetched).toMatchObject({
            status: 200,
            bytes: xml.length,
            isTruncated: false,
        });

        expect(file.fetched).not.toHaveProperty('body');
    });

    it('reads a cut gzipped sitemap up to its last whole entry and says it is cut', async () => {
        const root = 'https://acme.com/sitemap.xml.gz';
        const xml = urlset(['https://acme.com/a', 'https://acme.com/b']);

        const packed = gzipSync(xml.slice(0, xml.lastIndexOf('</url>')), {
            finishFlush: constants.Z_SYNC_FLUSH,
        });

        const { read } = site({ [root]: new Uint8Array(packed) });
        const [file] = await read([root]);

        expect(file.fetched).toMatchObject({ isTruncated: true });

        expect(file.sitemap.urls.map(({ loc }) => loc)).toEqual([
            'https://acme.com/a',
        ]);
    });

    it(`reads ${sitemapCap} files of an index that lists 130 000`, async () => {
        const root = 'https://acme.com/sitemap_index.xml';

        const children = Array.from(
            { length: 130_000 },
            (_, i) => `https://acme.com/sitemap-${i}.xml`,
        );

        const { read } = site({ [root]: index(children) });

        expect(await read([root])).toHaveLength(sitemapCap);
    });

    it('keeps a sitemap that did not answer as a file with no entries', async () => {
        const missing = 'https://acme.com/sitemap.xml';
        const { read } = site({});

        expect(await read([missing])).toMatchObject([
            {
                url: missing,
                fetched: { status: 404 },
                sitemap: { urls: [], sitemaps: [] },
            },
        ]);
    });
});

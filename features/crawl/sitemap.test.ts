import { describe, expect, it } from 'vitest';

import {
    readSitemap,
    sitemapEntries,
    sitemapsFromRobots,
} from '@/features/crawl/sitemap';

describe('sitemapsFromRobots', () => {
    it('reads every Sitemap line whatever its case', () => {
        const robots = [
            'User-agent: *',
            'Disallow: /admin',
            'Sitemap: https://yoursite.com/sitemap.xml',
            'sitemap:https://yoursite.com/news.xml',
            'Sitemap: not a url',
        ].join('\n');

        expect(sitemapsFromRobots(robots)).toEqual([
            'https://yoursite.com/sitemap.xml',
            'https://yoursite.com/news.xml',
        ]);
    });

    it('is empty for a file without sitemaps', () => {
        expect(sitemapsFromRobots('User-agent: *\nAllow: /')).toEqual([]);
    });
});

describe('sitemapEntries', () => {
    it('reads page locations from a urlset, one or many', () => {
        const one =
            '<urlset><url><loc>https://yoursite.com/</loc></url></urlset>';

        const many =
            '<urlset><url><loc>https://yoursite.com/</loc></url><url><loc> https://yoursite.com/blog </loc></url></urlset>';

        expect(sitemapEntries(one).pages).toEqual(['https://yoursite.com/']);

        expect(sitemapEntries(many).pages).toEqual([
            'https://yoursite.com/',
            'https://yoursite.com/blog',
        ]);
    });

    it('reads child sitemaps from a sitemap index', () => {
        const index =
            '<sitemapindex><sitemap><loc>https://yoursite.com/pages.xml</loc></sitemap></sitemapindex>';

        expect(sitemapEntries(index)).toEqual({
            pages: [],
            sitemaps: ['https://yoursite.com/pages.xml'],
        });
    });

    it('is empty for text that is not a sitemap', () => {
        expect(sitemapEntries('<html><body>404</body></html>')).toEqual({
            pages: [],
            sitemaps: [],
        });
    });
});

describe('readSitemap', () => {
    it('keeps lastmod, the hreflang alternates and the image and video children of each URL', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>https://yoursite.com/en/pricing</loc>
    <lastmod>2026-10-01</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="https://yoursite.com/en/pricing"/>
    <xhtml:link rel="alternate" hreflang="DE" href="https://yoursite.com/de/preise"/>
    <image:image><image:loc>https://yoursite.com/plans.png</image:loc></image:image>
    <video:video><video:title>Tour</video:title><video:content_loc>https://yoursite.com/tour.mp4</video:content_loc></video:video>
  </url>
  <url><loc>https://yoursite.com/en/about</loc></url>
</urlset>`;

        expect(readSitemap(xml).urls).toEqual([
            {
                loc: 'https://yoursite.com/en/pricing',
                lastmod: '2026-10-01',
                priority: null,
                changefreq: null,
                alternates: [
                    { lang: 'en', href: 'https://yoursite.com/en/pricing' },
                    { lang: 'de', href: 'https://yoursite.com/de/preise' },
                ],
                images: [{ loc: 'https://yoursite.com/plans.png' }],
                videos: [
                    {
                        title: 'Tour',
                        content_loc: 'https://yoursite.com/tour.mp4',
                    },
                ],
            },
            {
                loc: 'https://yoursite.com/en/about',
                lastmod: null,
                priority: null,
                changefreq: null,
                alternates: [],
                images: [],
                videos: [],
            },
        ]);
    });

    it('keeps the lastmod of each child of a sitemap index', () => {
        const index =
            '<sitemapindex><sitemap><loc>https://yoursite.com/a.xml</loc><lastmod>2026-09-30</lastmod></sitemap><sitemap><loc>https://yoursite.com/b.xml</loc></sitemap></sitemapindex>';

        expect(readSitemap(index).sitemaps).toEqual([
            { loc: 'https://yoursite.com/a.xml', lastmod: '2026-09-30' },
            { loc: 'https://yoursite.com/b.xml', lastmod: null },
        ]);
    });

    it('says how the file is written: its root, its namespace, whether it is well formed and the locations it could not take', () => {
        const xml =
            '<urlset xmlns="http://www.google.com/schemas/sitemap/0.84"><url><loc>/relative</loc></url><url><loc>https://yoursite.com/a?x=1&y=2</loc><priority>0.8</priority><changefreq>daily</changefreq></url></urlset>';

        expect(readSitemap(xml)).toMatchObject({
            root: 'urlset',
            namespace: 'http://www.google.com/schemas/sitemap/0.84',
            isWellFormed: false,
            rejected: ['/relative'],
            urls: [
                {
                    loc: 'https://yoursite.com/a?x=1&y=2',
                    priority: '0.8',
                    changefreq: 'daily',
                },
            ],
        });

        expect(
            readSitemap(
                '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>',
            ),
        ).toMatchObject({
            root: 'sitemapindex',
            namespace: 'http://www.sitemaps.org/schemas/sitemap/0.9',
            isWellFormed: true,
        });

        expect(readSitemap('<html><body>404</body></html>')).toMatchObject({
            root: null,
            namespace: null,
        });
    });

    it('reads a cut file up to its last whole entry, wherever the cut falls', () => {
        const xml =
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://yoursite.com/a</loc></url><url><loc>https://yoursite.com/b</loc><lastmod>2026-10-01</lastmod></url></urlset>';

        for (const end of ['yoursite.com/b', '/b</lo', '/b</loc><lastm']) {
            const cut = xml.slice(0, xml.indexOf(end) + end.length);

            expect(
                readSitemap(cut, true).urls.map(({ loc }) => loc),
                end,
            ).toEqual(['https://yoursite.com/a']);

            expect(readSitemap(cut, true).rejected, end).toEqual([]);
        }

        expect(
            sitemapEntries(
                '<sitemapindex><sitemap><loc>https://yoursite.com/a.xml</loc></sitemap><sitemap><loc>https://your',
                true,
            ).sitemaps,
        ).toEqual(['https://yoursite.com/a.xml']);
    });

    it('drops the entry a cut falls in after its loc, for the crawl too', () => {
        const cut =
            '<urlset><url><loc>https://yoursite.com/a</loc></url><url><loc>https://yoursite.com/b</loc>';

        expect(sitemapEntries(cut, true).pages).toEqual([
            'https://yoursite.com/a',
        ]);

        expect(
            sitemapEntries(
                '<sitemapindex><sitemap><loc>https://yoursite.com/a.xml</loc></sitemap><sitemap><loc>https://yoursite.com/b.xml</loc>',
                true,
            ).sitemaps,
        ).toEqual(['https://yoursite.com/a.xml']);
    });

    it('finds the end of an entry written with a namespace prefix', () => {
        const cut =
            '<s:urlset xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"><s:url><s:loc>https://yoursite.com/a</s:loc></s:url ><s:url><s:loc>https://yoursite.com/b</s:loc>';

        expect(readSitemap(cut, true).urls.map(({ loc }) => loc)).toEqual([
            'https://yoursite.com/a',
        ]);
    });
});

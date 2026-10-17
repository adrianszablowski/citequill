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
});

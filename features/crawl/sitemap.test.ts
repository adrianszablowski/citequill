import { describe, expect, it } from 'vitest';

import { sitemapEntries, sitemapsFromRobots } from '@/features/crawl/sitemap';

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

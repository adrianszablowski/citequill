import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import {
    escapeXml,
    type SitemapItem,
    sitemapFiles,
    sitemapIndex,
} from '@/features/content-api/sitemap-xml';

const item: SitemapItem = {
    url: 'https://acme.com/pl/blog/deload?a=1&b=2',
    lastmod: '2026-10-02T09:30:00.000Z',
    alternates: [
        { hreflang: 'pl', url: 'https://acme.com/pl/blog/deload?a=1&b=2' },
        { hreflang: 'x-default', url: 'https://acme.com/blog/deload' },
    ],
};

const parser = new XMLParser({ ignoreAttributes: false });

describe('escapeXml', () => {
    it('escapes the five characters XML reserves', () => {
        expect(escapeXml(`a&b<c>d"e'f`)).toBe(
            'a&amp;b&lt;c&gt;d&quot;e&apos;f',
        );
    });
});

describe('sitemapFiles', () => {
    it('writes one urlset with loc, lastmod and an xhtml:link per alternate', () => {
        const [file] = sitemapFiles([item]);
        const { urlset } = parser.parse(file);

        expect(urlset['@_xmlns:xhtml']).toBe('http://www.w3.org/1999/xhtml');
        expect(urlset.url.loc).toBe(item.url);
        expect(urlset.url.lastmod).toBe(item.lastmod);

        expect(
            urlset.url['xhtml:link'].map(
                (link: Record<string, string>) => link['@_hreflang'],
            ),
        ).toEqual(['pl', 'x-default']);

        expect(file).toContain('deload?a=1&amp;b=2');
    });

    it('writes an empty urlset for a host with no live page', () => {
        const files = sitemapFiles([]);

        expect(files).toHaveLength(1);
        expect(parser.parse(files[0])).toHaveProperty('urlset');
    });

    it('starts a new file at the URL limit', () => {
        const files = sitemapFiles([item, item, item], {
            bytes: 4_000_000,
            urls: 2,
        });

        expect(files).toHaveLength(2);
        expect(files[1].match(/<url>/g)).toHaveLength(1);
    });

    it('starts a new file before one would pass the size limit', () => {
        const one = Buffer.byteLength(sitemapFiles([item])[0]);
        const files = sitemapFiles([item, item], { bytes: one, urls: 50_000 });

        expect(files).toHaveLength(2);

        for (const file of files) {
            expect(Buffer.byteLength(file)).toBeLessThanOrEqual(one);
        }
    });
});

describe('sitemapIndex', () => {
    it('lists the files of a host', () => {
        const index = sitemapIndex([
            'https://citequill.com/api/v1/sites/s/sitemaps/acme.com/1.xml',
            'https://citequill.com/api/v1/sites/s/sitemaps/acme.com/2.xml',
        ]);

        expect(parser.parse(index).sitemapindex.sitemap).toHaveLength(2);
    });
});

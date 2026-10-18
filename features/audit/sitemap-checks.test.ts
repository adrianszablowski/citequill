import { describe, expect, it } from 'vitest';

import {
    imagesPerUrlCap,
    lastmodSample,
    locLengthCap,
    sitemapByteCap,
    sitemapChecks,
    sitemapEntryCap,
    sitemapNamespace,
} from '@/features/audit/sitemap-checks';
import type { SitemapFile } from '@/features/audit/sitemaps';
import { emptySitemap, readSitemap } from '@/features/crawl/sitemap';

const root = 'https://acme.com/sitemap.xml';
const now = Date.parse('2026-10-17T12:00:00Z');

function file(
    xml: string,
    {
        url = root,
        status = 200,
        finalUrl = url,
        headers = {},
        isTruncated = false,
    }: {
        url?: string;
        status?: number;
        finalUrl?: string;
        headers?: Record<string, string>;
        isTruncated?: boolean;
    } = {},
): SitemapFile {
    return {
        url,
        fetched: {
            ok: status === 200,
            status,
            url: finalUrl,
            headers: new Headers(headers),
            body: xml,
            isTruncated,
            hops: [{ url, status }],
            headersMs: 0,
        },
        sitemap: status === 200 ? readSitemap(xml) : emptySitemap,
    };
}

function urlset(entries: string[]) {
    return `<urlset xmlns="${sitemapNamespace}">${entries.join('')}</urlset>`;
}

function entry(loc: string, children = '') {
    return `<url><loc>${loc}</loc>${children}</url>`;
}

function checks(files: SitemapFile[], named: string[] = [root]) {
    return sitemapChecks(files, { named, now }).map((finding) => finding.check);
}

describe('sitemapChecks', () => {
    it('finds nothing in a plain sitemap that robots.txt names', () => {
        expect(
            checks([
                file(
                    urlset([
                        entry(
                            'https://acme.com/a',
                            '<lastmod>2026-10-01</lastmod>',
                        ),
                    ]),
                ),
            ]),
        ).toEqual([]);
    });

    it('reports a site with no sitemap named and none at /sitemap.xml, and the missing Sitemap line as a hint', () => {
        expect(checks([file('<html><body>Home</body></html>')], [])).toEqual([
            'sitemap-not-in-robots',
            'sitemap-missing',
        ]);

        expect(checks([file('', { status: 404 })], [])).toEqual([
            'sitemap-not-in-robots',
            'sitemap-missing',
        ]);

        expect(
            checks([file(urlset([entry('https://acme.com/a')]))], []),
        ).toEqual(['sitemap-not-in-robots']);
    });

    it('reports a named sitemap or an index child that does not answer 200 or leaves its host', () => {
        const child = 'https://acme.com/posts.xml';

        const index = file(
            `<sitemapindex xmlns="${sitemapNamespace}"><sitemap><loc>${child}</loc></sitemap></sitemapindex>`,
        );

        expect(checks([index, file('', { url: child, status: 404 })])).toEqual([
            'sitemap-unreachable',
        ]);

        expect(
            checks([
                file(urlset([]), { finalUrl: 'https://cdn.other.com/s.xml' }),
            ]),
        ).toEqual(['sitemap-unreachable']);

        expect(
            sitemapChecks(
                [
                    {
                        url: root,
                        fetched: new Error('timeout'),
                        sitemap: emptySitemap,
                    },
                ],
                { named: [root], now },
            ),
        ).toMatchObject([
            { check: 'sitemap-unreachable', detail: { error: 'timeout' } },
        ]);
    });

    it('reports a sitemap over 50 000 entries or 50 MB', () => {
        const many = Array.from({ length: sitemapEntryCap + 1 }, (_, i) =>
            entry(`https://acme.com/p${i}`),
        );

        expect(checks([file(urlset(many))])).toEqual(['sitemap-limits']);

        expect(
            checks([
                file(urlset([]), {
                    headers: { 'content-length': String(sitemapByteCap + 1) },
                }),
            ]),
        ).toEqual(['sitemap-limits']);
    });

    it('reports a wrong namespace, a relative or overlong <loc>, broken XML and a named file that is no sitemap', () => {
        const [wrong] = sitemapChecks(
            [
                file(
                    `<urlset xmlns="http://www.google.com/schemas/sitemap/0.84">${entry('/relative')}${entry(`https://acme.com/${'a'.repeat(locLengthCap)}`)}${entry('https://acme.com/a?x=1&y=2')}</urlset>`,
                ),
            ],
            { named: [root], now },
        );

        expect(wrong).toMatchObject({
            check: 'sitemap-invalid',
            subject: root,
            detail: {
                problems: [
                    'not well-formed XML',
                    'wrong namespace',
                    'relative <loc>',
                    `<loc> over ${locLengthCap} characters`,
                ],
                rejected: ['/relative'],
            },
        });

        expect(checks([file('<html><body>Home</body></html>')])).toEqual([
            'sitemap-invalid',
        ]);
    });

    it('does not call a sitemap the fetch cut at 2 MB broken', () => {
        const cut = `${urlset([entry('https://acme.com/a')]).slice(0, -12)}`;

        expect(checks([file(cut, { isTruncated: true })])).toEqual([]);
        expect(checks([file(cut)])).toEqual(['sitemap-invalid']);
    });

    it('reports a URL on another protocol or host, or above the folder of its sitemap', () => {
        const [finding] = sitemapChecks(
            [
                file(
                    urlset([
                        entry('https://acme.com/blog/a'),
                        entry('https://acme.com/about'),
                        entry('http://acme.com/blog/b'),
                        entry('https://www.acme.com/blog/c'),
                    ]),
                    { url: 'https://acme.com/blog/sitemap.xml' },
                ),
            ],
            { named: ['https://acme.com/blog/sitemap.xml'], now },
        );

        expect(finding).toMatchObject({
            check: 'sitemap-scope',
            detail: { count: 3 },
        });
    });

    it('reports a lastmod in the wrong format, in the future, or the same on over 90% of at least 10 entries', () => {
        const dated = (lastmod: string) =>
            entry('https://acme.com/a', `<lastmod>${lastmod}</lastmod>`);

        expect(checks([file(urlset([dated('17/10/2026')]))])).toEqual([
            'sitemap-lastmod',
        ]);

        expect(checks([file(urlset([dated('2026-12-01')]))])).toEqual([
            'sitemap-lastmod',
        ]);

        expect(
            checks([file(urlset([dated('2026-10-18T09:00:00+02:00')]))]),
        ).toEqual([]);

        const same = Array.from({ length: lastmodSample }, () =>
            dated('2026-10-01'),
        );

        expect(checks([file(urlset(same))])).toEqual(['sitemap-lastmod']);

        expect(checks([file(urlset(same.slice(1)))])).toEqual([]);
    });

    it('notes priority and changefreq as a hint', () => {
        expect(
            checks([
                file(
                    urlset([
                        entry('https://acme.com/a', '<priority>0.5</priority>'),
                    ]),
                ),
            ]),
        ).toEqual(['sitemap-priority']);
    });

    it('reports too many images, deprecated image tags and a video without its required tags', () => {
        const images = Array.from(
            { length: imagesPerUrlCap + 1 },
            (_, i) =>
                `<image:image><image:loc>https://acme.com/${i}.png</image:loc></image:image>`,
        ).join('');

        const [finding] = sitemapChecks(
            [
                file(
                    urlset([
                        entry('https://acme.com/a', images),
                        entry(
                            'https://acme.com/b',
                            '<image:image><image:loc>https://acme.com/b.png</image:loc><image:caption>B</image:caption></image:image>',
                        ),
                        entry(
                            'https://acme.com/c',
                            '<video:video><video:title>C</video:title><video:content_loc>https://acme.com/c.mp4</video:content_loc></video:video>',
                        ),
                        entry(
                            'https://acme.com/d',
                            '<video:video><video:thumbnail_loc>https://acme.com/d.jpg</video:thumbnail_loc><video:title>D</video:title><video:description>D</video:description><video:player_loc>https://acme.com/d</video:player_loc></video:video>',
                        ),
                    ]),
                ),
            ],
            { named: [root], now },
        );

        expect(finding).toMatchObject({
            check: 'sitemap-extensions',
            detail: {
                overImageCap: 1,
                deprecatedImageTags: 1,
                incompleteVideos: 1,
                example: 'https://acme.com/a',
            },
        });
    });
});

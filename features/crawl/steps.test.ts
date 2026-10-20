import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultDeps } from '@/features/crawl/fetch';
import { discoverPages, frontierCap } from '@/features/crawl/steps';

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

vi.mock('@/features/runs/steps', () => {
    return { addUsage: vi.fn(), markProgress: vi.fn() };
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('discoverPages', () => {
    it('unpacks a gzipped sitemap and reads one whose answer stopped partway up to its last whole entry', async () => {
        const cut = urlset([
            'https://acme.com/whole',
            'https://acme.com/partial-page',
        ]);

        serve({
            'https://acme.com/robots.txt': () =>
                new Response(
                    'Sitemap: https://acme.com/a.xml.gz\nSitemap: https://acme.com/b.xml',
                ),
            'https://acme.com/a.xml.gz': () =>
                new Response(gzipSync(urlset(['https://acme.com/zipped']))),
            'https://acme.com/b.xml': () => {
                let isSent = false;

                return new Response(
                    new ReadableStream({
                        pull(controller) {
                            if (isSent) {
                                controller.error(new TypeError('terminated'));
                            } else {
                                controller.enqueue(
                                    Buffer.from(
                                        cut.slice(0, cut.lastIndexOf('</url>')),
                                    ),
                                );

                                isSent = true;
                            }
                        },
                    }),
                );
            },
        });

        const { candidates } = await discoverPages('run', 'acme.com');

        expect(candidates).toEqual(
            expect.arrayContaining([
                'https://acme.com/zipped',
                'https://acme.com/whole',
            ]),
        );

        expect(candidates).not.toContain('https://acme.com/partial-page');
    });

    it('reads a sitemap and an index of 130 000 entries each', async () => {
        const locs = Array.from(
            { length: 130_000 },
            (_, i) => `https://acme.com/page-${i}`,
        );

        serve({
            'https://acme.com/robots.txt': () =>
                new Response(
                    'Sitemap: https://acme.com/pages.xml\nSitemap: https://acme.com/index.xml',
                ),
            'https://acme.com/pages.xml': () => new Response(urlset(locs)),
            'https://acme.com/index.xml': () =>
                new Response(
                    `<sitemapindex>${locs
                        .map(
                            (loc) => `<sitemap><loc>${loc}.xml</loc></sitemap>`,
                        )
                        .join('')}</sitemapindex>`,
                ),
        });

        const { candidates } = await discoverPages('run', 'acme.com');

        expect(candidates).toHaveLength(frontierCap);
    });
});

function serve(files: Record<string, () => Response>) {
    vi.spyOn(defaultDeps, 'lookup').mockResolvedValue(['93.184.216.34']);

    vi.spyOn(defaultDeps, 'fetch').mockImplementation(async (input) => {
        const url = String(input);

        if (url === 'https://acme.com/') {
            return new Response('<h1>Acme</h1>', {
                headers: { 'content-type': 'text/html' },
            });
        }

        return files[url]?.() ?? new Response('', { status: 404 });
    });
}

function urlset(locs: string[]) {
    return `<urlset>${locs
        .map((loc) => `<url><loc>${loc}</loc></url>`)
        .join('')}</urlset>`;
}

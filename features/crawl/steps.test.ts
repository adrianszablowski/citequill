import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultDeps } from '@/features/crawl/fetch';
import type { Signals } from '@/features/crawl/signals';
import {
    discoverPages,
    fillOrganization,
    frontierCap,
    saveLocales,
} from '@/features/crawl/steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { fakeSupabase, type FakeQuery } from '@/lib/supabase/fake';

vi.mock('server-only', () => {
    return {};
});

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

describe('fillOrganization', () => {
    const empty = {
        name: 'Acme',
        organization_name: null,
        organization_url: null,
        organization_logo_url: null,
        organization_same_as: [],
    };

    const signals: Partial<Signals> = {
        logo: 'https://acme.com/logo.svg',
        headerLogo: null,
        sameAs: [],
        socialLinks: ['https://x.com/acme'],
    };

    function database(project: object, homeSignals: object | null = signals) {
        const fake = fakeSupabase(({ name, calls }) => {
            if (name === 'project_locales') {
                return {
                    data: [
                        {
                            locale: 'en',
                            base_url: 'https://www.acme.com/en',
                            is_default: true,
                        },
                    ],
                };
            }

            if (name === 'crawled_pages') {
                return {
                    data: [{ url: 'https://acme.com/', signals: homeSignals }],
                };
            }

            return calls[0][0] === 'select' ? { data: project } : {};
        });

        vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

        return fake;
    }

    function writes(fake: ReturnType<typeof fakeSupabase>) {
        return fake.queries
            .filter(({ calls }) => ['update', 'rpc'].includes(calls[0][0]))
            .map(({ calls }) => calls[0]);
    }

    it("fills every empty field: the project's name, the main origin, the checked logo and the social profiles, then moves the live pages", async () => {
        serve({
            'https://acme.com/logo.svg': () =>
                new Response('<svg viewBox="0 0 240 60"></svg>'),
        });

        const fake = database(empty);

        await fillOrganization('project', 'run', 'https://acme.com/');

        expect(writes(fake)).toEqual([
            [
                'update',
                {
                    organization_name: 'Acme',
                    organization_url: 'https://www.acme.com',
                    organization_same_as: ['https://x.com/acme'],
                },
            ],
            [
                'update',
                {
                    organization_logo_url: 'https://acme.com/logo.svg',
                    organization_logo_width: 240,
                    organization_logo_height: 60,
                },
            ],
            ['rpc', { project: 'project', author: undefined }],
        ]);
    });

    it("checks the header's logo when the JSON-LD logo fails its check, and prefers the organization's sameAs to the social links", async () => {
        serve({
            'https://acme.com/header.png': () =>
                new Response('<svg width="300" height="80"></svg>'),
        });

        const fake = database(empty, {
            ...signals,
            headerLogo: 'https://acme.com/header.png',
            sameAs: ['https://www.linkedin.com/company/acme'],
        });

        await fillOrganization('project', 'run', 'https://acme.com/');

        expect(writes(fake)).toEqual([
            [
                'update',
                {
                    organization_name: 'Acme',
                    organization_url: 'https://www.acme.com',
                    organization_same_as: [
                        'https://www.linkedin.com/company/acme',
                    ],
                },
            ],
            [
                'update',
                {
                    organization_logo_url: 'https://acme.com/header.png',
                    organization_logo_width: 300,
                    organization_logo_height: 80,
                },
            ],
            ['rpc', { project: 'project', author: undefined }],
        ]);
    });

    it('leaves the logo empty when no logo passes its check, and moves the live pages for the profiles alone', async () => {
        serve({});

        const fake = database(
            { ...empty, organization_name: 'Acme', organization_url: 'x' },
            { ...signals, headerLogo: 'https://acme.com/header.png' },
        );

        await fillOrganization('project', 'run', 'https://acme.com/');

        expect(writes(fake)).toEqual([
            ['update', { organization_same_as: ['https://x.com/acme'] }],
            ['rpc', { project: 'project', author: undefined }],
        ]);
    });

    it('moves no live page when it fills only the name and the URL, as with a home page that has no signals', async () => {
        serve({});

        const fake = database(empty, null);

        await fillOrganization('project', 'run', 'https://acme.com/');

        expect(writes(fake)).toEqual([
            [
                'update',
                {
                    organization_name: 'Acme',
                    organization_url: 'https://www.acme.com',
                },
            ],
        ]);

        expect(defaultDeps.fetch).not.toHaveBeenCalled();
    });

    it('leaves alone every field the owner filled, and writes nothing when none is empty', async () => {
        serve({});

        const fake = database({
            name: 'Acme',
            organization_name: 'Acme Inc.',
            organization_url: 'https://acme.com',
            organization_logo_url: 'https://acme.com/mark.png',
            organization_same_as: ['https://x.com/acme'],
        });

        await fillOrganization('project', 'run', 'https://acme.com/');

        expect(fake.writes()).toEqual([]);
        expect(defaultDeps.fetch).not.toHaveBeenCalled();
    });
});

describe('saveLocales', () => {
    function database(
        stored: { locale: string; base_url: string }[],
        live: string[],
    ) {
        const fake = fakeSupabase(({ name, calls }: FakeQuery) => {
            if (name === 'published_pages') {
                const locale = calls.find(
                    ([method, column]) =>
                        method === 'eq' && column === 'locale',
                )?.[2];

                return { count: live.includes(String(locale)) ? 4 : 0 };
            }

            return calls[0][0] === 'select' ? { data: stored } : {};
        });

        vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

        return fake;
    }

    function written(fake: ReturnType<typeof fakeSupabase>, method: string) {
        return fake.queries.find(({ calls }) => calls[0][0] === method)?.calls;
    }

    const pages = [
        {
            url: 'https://acme.com/',
            lang: 'en',
            alternates: [
                { lang: 'en', href: 'https://acme.com/' },
                { lang: 'pl', href: 'https://pl.acme.com/' },
                { lang: 'it', href: 'https://acme.com/it/' },
            ],
            author: null,
            links: [],
        },
    ];

    it('keeps the base URL of a locale that has live pages, and a locale with live pages the site no longer lists', async () => {
        const fake = database(
            [
                { locale: 'en', base_url: 'https://acme.com' },
                { locale: 'pl', base_url: 'https://acme.com/pl' },
                { locale: 'de', base_url: 'https://acme.com/de' },
            ],
            ['pl', 'de'],
        );

        await saveLocales('project', 'run', 'https://acme.com', pages);

        expect(written(fake, 'upsert')).toEqual([
            [
                'upsert',
                [
                    {
                        project_id: 'project',
                        locale: 'en',
                        base_url: 'https://acme.com',
                        is_default: true,
                    },
                    {
                        project_id: 'project',
                        locale: 'pl',
                        base_url: 'https://acme.com/pl',
                        is_default: false,
                    },
                    {
                        project_id: 'project',
                        locale: 'it',
                        base_url: 'https://acme.com/it',
                        is_default: false,
                    },
                    {
                        project_id: 'project',
                        locale: 'de',
                        base_url: 'https://acme.com/de',
                        is_default: false,
                    },
                ],
                { onConflict: 'project_id,locale' },
            ],
        ]);

        expect(written(fake, 'delete')).toBeUndefined();
    });

    it('takes the base URL the crawl read for a locale with no live page, and removes a locale the site and the live pages left', async () => {
        const fake = database(
            [
                { locale: 'pl', base_url: 'https://acme.com/pl' },
                { locale: 'fr', base_url: 'https://acme.com/fr' },
            ],
            [],
        );

        await saveLocales('project', 'run', 'https://acme.com', pages);

        expect(written(fake, 'upsert')?.[0][1]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    locale: 'pl',
                    base_url: 'https://pl.acme.com',
                }),
            ]),
        );

        expect(written(fake, 'delete')).toEqual([
            ['delete'],
            ['eq', 'project_id', 'project'],
            ['in', 'locale', ['fr']],
        ]);
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

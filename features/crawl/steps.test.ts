import { gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultDeps } from '@/features/crawl/fetch';
import type { Signals } from '@/features/crawl/signals';
import {
    discoverPages,
    fetchPages,
    fillOrganization,
    frontierCap,
    moveLivePages,
    nameSite,
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

describe('fetchPages', () => {
    it('writes a page\'s locale only from a lang whose language is 2 or 3 letters, so lang="english" is no locale', async () => {
        const fake = fakeSupabase(({ name }: FakeQuery) =>
            name === 'site_pages' ? { data: [] } : {},
        );

        vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

        serve({
            'https://acme.com/about': () => html('english'),
            'https://acme.com/de/uber': () => html('de-de'),
        });

        await fetchPages(
            'project',
            'run',
            ['https://acme.com/about', 'https://acme.com/de/uber'],
            [],
        );

        type Row = { locale: unknown };

        const locales = (table: string) =>
            fake.queries
                .filter(({ name }) => name === table)
                .flatMap(({ calls }) => calls[0][1] as Row | Row[])
                .map(({ locale }) => locale);

        expect(locales('crawled_pages')).toEqual([null, 'de-DE']);
        expect(locales('site_pages')).toEqual([null, 'de-DE']);
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

    it("fills every empty field: the project's name, the main origin, the checked logo and the social profiles, and says the live pages move", async () => {
        serve({
            'https://acme.com/logo.svg': () =>
                new Response('<svg viewBox="0 0 240 60"></svg>'),
        });

        const fake = database(empty);

        expect(
            await fillOrganization('project', 'run', 'https://acme.com/'),
        ).toBe(true);

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

        expect(
            await fillOrganization('project', 'run', 'https://acme.com/'),
        ).toBe(true);

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
        ]);
    });

    it('leaves the logo empty when no logo passes its check, and says the live pages move for the profiles alone', async () => {
        serve({});

        const fake = database(
            { ...empty, organization_name: 'Acme', organization_url: 'x' },
            { ...signals, headerLogo: 'https://acme.com/header.png' },
        );

        expect(
            await fillOrganization('project', 'run', 'https://acme.com/'),
        ).toBe(true);

        expect(writes(fake)).toEqual([
            ['update', { organization_same_as: ['https://x.com/acme'] }],
        ]);
    });

    it('moves no live page when it fills only the name and the URL, as with a home page that has no signals', async () => {
        serve({});

        const fake = database(empty, null);

        expect(
            await fillOrganization('project', 'run', 'https://acme.com/'),
        ).toBe(false);

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

        expect(
            await fillOrganization('project', 'run', 'https://acme.com/'),
        ).toBe(false);

        expect(fake.writes()).toEqual([]);
        expect(defaultDeps.fetch).not.toHaveBeenCalled();
    });
});

describe('nameSite', () => {
    function database(project: object) {
        const fake = fakeSupabase(({ name, calls }) => {
            if (name === 'crawled_pages') {
                return {
                    data: [
                        {
                            url: 'https://acme.com/',
                            signals: { siteName: 'Acme Shop' },
                        },
                    ],
                };
            }

            return calls[0][0] === 'select' ? { data: project } : {};
        });

        vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

        return fake;
    }

    it("says the live pages move when the publisher's name is the project's and the name changed, and moves none itself", async () => {
        const fake = database({ name: 'Acme', organization_name: null });

        expect(
            await nameSite(
                'project',
                'run',
                'acme.com',
                'https://acme.com/',
                [],
            ),
        ).toEqual({ siteName: 'Acme Shop', shouldMove: true });

        expect(fake.writes()).toEqual(['update projects']);
    });

    it('says no live page moves when the organization has a name of its own, or the name stays', async () => {
        for (const project of [
            { name: 'Acme', organization_name: 'Acme Inc.' },
            { name: 'Acme Shop', organization_name: null },
        ]) {
            database(project);

            expect(
                await nameSite(
                    'project',
                    'run',
                    'acme.com',
                    'https://acme.com/',
                    [],
                ),
            ).toEqual({ siteName: 'Acme Shop', shouldMove: false });
        }
    });
});

describe('saveLocales', () => {
    function database(
        stored: { locale: string; base_url: string; is_default?: boolean }[],
        live: string[],
        organizationUrl: string | null = 'https://acme.com',
    ) {
        const fake = fakeSupabase(({ name, calls }: FakeQuery) => {
            if (name === 'projects') {
                return {
                    data: { name: 'Acme', organization_url: organizationUrl },
                };
            }

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

    const english = { locale: 'en', is_default: true };

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

    it('says the live pages move when the default locale changes while the old one has live pages, because it decides x-default, and moves none itself', async () => {
        const fake = database(
            [
                {
                    locale: 'pl',
                    base_url: 'https://acme.com',
                    is_default: true,
                },
                {
                    locale: 'en',
                    base_url: 'https://acme.com',
                    is_default: false,
                },
            ],
            ['pl'],
        );

        expect(
            await saveLocales('project', 'run', 'https://acme.com', pages),
        ).toBe(true);

        expect(fake.queries.map(({ name }) => name)).not.toContain(
            'touch_live_pages',
        );
    });

    it('says the live pages move when the new default locale has live pages', async () => {
        database(
            [
                {
                    locale: 'pl',
                    base_url: 'https://acme.com',
                    is_default: true,
                },
                { locale: 'en', base_url: 'https://acme.com' },
            ],
            ['en'],
        );

        expect(
            await saveLocales('project', 'run', 'https://acme.com', pages),
        ).toBe(true);
    });

    it('says no live page moves when the default locale changes and neither it nor the old one has a live page', async () => {
        database(
            [
                {
                    locale: 'pl',
                    base_url: 'https://acme.com',
                    is_default: true,
                },
                { locale: 'en', base_url: 'https://acme.com' },
            ],
            ['it'],
        );

        expect(
            await saveLocales('project', 'run', 'https://acme.com', pages),
        ).toBe(false);
    });

    it("says the live pages move when the default base URL's origin changes while the organization has no URL, because it is the publisher's URL", async () => {
        database([{ ...english, base_url: 'https://www.acme.com' }], [], null);

        expect(
            await saveLocales('project', 'run', 'https://acme.com', pages),
        ).toBe(true);
    });

    it('says no live page moves when only the default base URL changes and the organization has a URL of its own', async () => {
        database([{ ...english, base_url: 'https://www.acme.com' }], []);

        expect(
            await saveLocales('project', 'run', 'https://acme.com', pages),
        ).toBe(false);
    });

    it('says no live page moves when only the prefix of the default base URL changes', async () => {
        database([{ ...english, base_url: 'https://acme.com/en' }], [], null);

        expect(
            await saveLocales('project', 'run', 'https://acme.com', pages),
        ).toBe(false);
    });

    it('says no live page moves when the default locale and its base URL stay', async () => {
        database(
            [
                { ...english, base_url: 'https://acme.com' },
                { locale: 'pl', base_url: 'https://pl.acme.com' },
            ],
            ['en', 'pl'],
            null,
        );

        expect(
            await saveLocales('project', 'run', 'https://acme.com', pages),
        ).toBe(false);
    });
});

describe('moveLivePages', () => {
    it('touches the live pages again when its first touch failed, because the Workflow runs the step again by itself', async () => {
        let attempt = 0;

        const fake = fakeSupabase(() => {
            attempt += 1;

            return attempt === 1
                ? { error: { message: 'The database did not answer.' } }
                : { data: [] };
        });

        vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

        await expect(moveLivePages('project', 'run')).rejects.toThrow(
            'The database did not answer.',
        );

        await moveLivePages('project', 'run');

        expect(fake.queries.map(({ calls }) => calls)).toEqual([
            [['rpc', { project: 'project', author: undefined }]],
            [['rpc', { project: 'project', author: undefined }]],
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

function html(lang: string) {
    return new Response(
        `<html lang="${lang}"><body><h1>Acme</h1></body></html>`,
        {
            headers: { 'content-type': 'text/html' },
        },
    );
}

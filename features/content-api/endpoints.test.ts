import { cacheLife, cacheTag } from 'next/cache';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getHostSitemap,
    getPage,
    getPages,
    getRedirects,
    getSitemap,
    getSitemapFile,
} from '@/features/content-api/endpoints';
import { apiCacheLife } from '@/features/content-api/cache';
import { generateKey } from '@/features/content-api/key';
import { decodeSyncToken, encodeCursor } from '@/features/content-api/paging';
import { readSync } from '@/features/content-api/reads';
import { createAdminClient } from '@/lib/supabase/admin';
import { fakeSupabase, type FakeQuery } from '@/lib/supabase/fake';

vi.mock('server-only', () => {
    return {};
});

vi.mock('next/cache', () => {
    return { cacheLife: vi.fn(), cacheTag: vi.fn() };
});

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

vi.mock('@/features/content-api/reads', async (importOriginal) => {
    const reads =
        await importOriginal<typeof import('@/features/content-api/reads')>();

    return { ...reads, readSync: vi.fn(reads.readSync) };
});

const { key } = generateKey();

const site = {
    project_name: 'Acme',
    organization_name: null,
    organization_url: null,
    organization_logo_url: null,
    organization_logo_width: null,
    organization_logo_height: null,
    organization_same_as: [],
    locales: [{ locale: 'pl', base_url: 'https://acme.com', is_default: true }],
};

function version(id: string, extra: object = {}) {
    return {
        id,
        project_id: 'project',
        status: 'published',
        published_at: '2026-10-01T08:00:00.123456+00:00',
        unpublished_at: null,
        redirect_to: null,
        kind: 'Blog',
        kind_url_prefix: '/blog',
        locale: 'pl',
        locale_base_url: 'https://acme.com',
        host: 'acme.com',
        slug: 'deload',
        path: '/blog/deload',
        url: 'https://acme.com/blog/deload',
        title: 'Deload',
        meta_title: 'Deload',
        meta_description: 'When to rest.',
        excerpt: 'A week of rest.',
        body_md: 'Rest.',
        body_html: '<p>Rest.</p>',
        toc: [],
        word_count: 1,
        reading_minutes: 1,
        faq: [],
        sources: [],
        tags: [],
        author_name: 'Jane',
        author_title: '',
        author_url: '',
        author_same_as: [],
        modified_at: '2026-10-02T09:30:00+00:00',
        updated_at: '2026-10-03T10:00:00.654321+00:00',
        alternates: [
            {
                locale: 'pl',
                url: 'https://acme.com/blog/deload',
                is_default: true,
            },
        ],
        ...extra,
    };
}

const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
];

function database(answers: Record<string, unknown> = {}) {
    const fake = fakeSupabase(({ name }: FakeQuery) => {
        const all: Record<string, unknown> = {
            api_key_project: [{ project_id: 'project', site_id: 'site' }],
            api_site: [site],
            api_pages: [],
            ...answers,
        };

        const value = name in all ? all[name] : [];

        return value instanceof Error
            ? { error: { message: value.message } }
            : { data: value };
    });

    vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

    return fake;
}

function request(path: string, headers: Record<string, string> = {}) {
    return new NextRequest(`https://citequill.com/api/v1/sites/site${path}`, {
        headers: { Authorization: `Bearer ${key}`, ...headers },
    });
}

function rpcArgs(fake: ReturnType<typeof database>, name: string) {
    return fake.queries.find((query) => query.name === name)?.calls[0][1];
}

function queryNames(fake: ReturnType<typeof database>) {
    return fake.queries.map((query) => query.name);
}

function failFirstCachedRead(fake: ReturnType<typeof database>) {
    const { rpc } = fake.client;
    let hasFailed = false;

    fake.client.rpc = ((name: string, args: object) => {
        if (hasFailed || uncachedReads.has(name)) {
            return rpc(name, args);
        }

        hasFailed = true;

        return Promise.resolve({
            data: null,
            error: { message: 'Runtime Cache did not answer' },
        });
    }) as typeof rpc;
}

const uncachedReads = new Set([
    'api_key_project',
    'api_sitemap_project',
    'api_site_exists',
]);

const keyedEndpoints = {
    '/pages': (request: NextRequest, siteId: string) =>
        getPages(request, siteId),
    '/pages?sync=start': (request: NextRequest, siteId: string) =>
        getPages(request, siteId),
    '/pages/pl/deload': (request: NextRequest, siteId: string) =>
        getPage(request, siteId, 'pl', 'deload'),
    '/redirects': (request: NextRequest, siteId: string) =>
        getRedirects(request, siteId),
    '/sitemap': (request: NextRequest, siteId: string) =>
        getSitemap(request, siteId),
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the key', () => {
    it('answers 401 missing_key with a challenge and asks no database when no key is sent', async () => {
        const fake = database();

        const answer = await getPages(
            new NextRequest('https://citequill.com/api/v1/sites/site/pages'),
            'site',
        );

        expect(answer.status).toBe(401);

        expect(answer.headers.get('WWW-Authenticate')).toBe(
            'Bearer realm="citequill"',
        );

        expect(answer.headers.get('Content-Type')).toBe(
            'application/problem+json',
        );

        expect(await answer.json()).toMatchObject({
            status: 401,
            code: 'missing_key',
        });

        expect(fake.queries).toEqual([]);
    });

    it('refuses a mistyped key with invalid_token before asking the database', async () => {
        const fake = database();
        const typo = `${key.slice(0, -1)}${key.endsWith('a') ? 'b' : 'a'}`;

        const answer = await getPages(
            request('/pages', { Authorization: `Bearer ${typo}` }),
            'site',
        );

        expect(answer.status).toBe(401);

        expect(answer.headers.get('WWW-Authenticate')).toBe(
            'Bearer realm="citequill", error="invalid_token"',
        );

        expect((await answer.json()).code).toBe('invalid_key');
        expect(fake.queries).toEqual([]);
    });

    it('answers invalid_key for a key the database does not know', async () => {
        database({ api_key_project: [] });

        const answer = await getPages(request('/pages'), 'site');

        expect(answer.status).toBe(401);
        expect((await answer.json()).code).toBe('invalid_key');
    });

    it("answers 403 wrong_site for a valid key on another project's path", async () => {
        database();

        const answer = await getPages(request('/pages'), 'other-site');

        expect(answer.status).toBe(403);
        expect((await answer.json()).code).toBe('wrong_site');
    });
});

describe('the key on every keyed endpoint', () => {
    for (const [path, endpoint] of Object.entries(keyedEndpoints)) {
        it(`reads nothing but the key on ${path} when the key is missing, unknown or of another site`, async () => {
            const missing = database();

            const noKey = await endpoint(
                new NextRequest(
                    `https://citequill.com/api/v1/sites/site${path}`,
                ),
                'site',
            );

            expect(noKey.status).toBe(401);
            expect(queryNames(missing)).toEqual([]);

            const unknown = database({ api_key_project: [] });
            const unknownKey = await endpoint(request(path), 'site');

            expect(unknownKey.status).toBe(401);
            expect(queryNames(unknown)).toEqual(['api_key_project']);

            const other = database();
            const otherSite = await endpoint(request(path), 'other-site');

            expect(otherSite.status).toBe(403);
            expect(queryNames(other)).toEqual(['api_key_project']);
            expect(cacheTag).not.toHaveBeenCalled();
        });
    }
});

describe("the project's cache tag and lifetime", () => {
    for (const [path, endpoint] of Object.entries(keyedEndpoints)) {
        it(`tags the read of ${path} with the project, so a clear reaches it, and keeps it for the API's lifetime`, async () => {
            database({ api_page: [version(ids[0])] });

            await endpoint(request(path), 'site');

            expect(cacheTag).toHaveBeenCalledWith('content-api-project');
            expect(cacheLife).toHaveBeenCalledWith(apiCacheLife);
        });
    }

    it("tags the read of a host's XML sitemap with the project, and keeps it for the API's lifetime", async () => {
        database({ api_sitemap_project: 'project', api_host_sitemap: [] });

        await getHostSitemap(
            new NextRequest(
                'https://citequill.com/api/v1/sites/site/sitemaps/acme.com.xml',
            ),
            'site',
            'acme.com.xml',
        );

        expect(cacheTag).toHaveBeenCalledWith('content-api-project');
        expect(cacheLife).toHaveBeenCalledWith(apiCacheLife);
    });
});

describe('a cached read that fails', () => {
    for (const [path, endpoint] of Object.entries(keyedEndpoints)) {
        it(`reads ${path} again without the cache, so a failing cache alone never fails the answer`, async () => {
            failFirstCachedRead(database({ api_page: [version(ids[0])] }));

            const answer = await endpoint(request(path), 'site');

            expect(answer.status).toBe(200);
        });
    }

    it("reads a host's XML sitemap again without the cache", async () => {
        failFirstCachedRead(
            database({ api_sitemap_project: 'project', api_host_sitemap: [] }),
        );

        const answer = await getHostSitemap(
            new NextRequest(
                'https://citequill.com/api/v1/sites/site/sitemaps/acme.com.xml',
            ),
            'site',
            'acme.com.xml',
        );

        expect(answer.status).toBe(200);
    });
});

describe('an error no check foresaw', () => {
    it('answers 500 server_error as a problem with the cache headers', async () => {
        database({ api_pages: new Error('connection reset') });

        const answer = await getPages(request('/pages'), 'site');

        expect(answer.status).toBe(500);

        expect(answer.headers.get('Content-Type')).toBe(
            'application/problem+json',
        );

        expect(answer.headers.get('Cache-Control')).toBe('private, no-cache');
        expect((await answer.json()).code).toBe('server_error');
    });
});

describe('the list of pages', () => {
    it('asks for one row more than the limit and gives the next page as a cursor and a Link', async () => {
        const fake = database({
            api_pages: [version(ids[0]), version(ids[1])],
        });

        const answer = await getPages(request('/pages?limit=1'), 'site');
        const body = await answer.json();

        expect(rpcArgs(fake, 'api_pages')).toMatchObject({ page_limit: 2 });
        expect(body.pages).toHaveLength(1);

        expect(body.nextCursor).toBe(
            encodeCursor(
                'pages',
                { key: '2026-10-01T08:00:00.123456+00:00', id: ids[0] },
                { locale: null, kind: null },
            ),
        );

        expect(answer.headers.get('Link')).toBe(
            `<https://citequill.com/api/v1/sites/site/pages?limit=1&cursor=${body.nextCursor}>; rel="next"`,
        );

        expect(answer.headers.get('Cache-Control')).toBe('private, no-cache');
        expect(answer.headers.get('ETag')).toMatch(/^W\/".+"$/);
    });

    it('lowers a limit over 25 and has no next page when the extra row does not come', async () => {
        const fake = database({ api_pages: [version(ids[0])] });

        const answer = await getPages(request('/pages?limit=80'), 'site');

        expect(rpcArgs(fake, 'api_pages')).toMatchObject({ page_limit: 26 });
        expect((await answer.json()).nextCursor).toBeNull();
        expect(answer.headers.get('Link')).toBeNull();
    });

    it('filters by a locale written in any case and by kind', async () => {
        const fake = database();

        await getPages(request('/pages?locale=EN-us&kind=Blog'), 'site');

        expect(rpcArgs(fake, 'api_pages')).toMatchObject({
            page_locale: 'en-US',
            kind_name: 'Blog',
        });
    });

    it('serves a page whose stored FAQ, table of contents or sources are malformed with an empty list, and the rest of the list', async () => {
        const good = {
            faq: [{ question: 'Why?', answer: 'Rest.' }],
            toc: [{ id: 'rest', text: 'Rest', level: 2 }],
            sources: [{ title: 'A study', url: 'https://example.org/study' }],
        };

        database({
            api_pages: [
                version(ids[0], {
                    faq: [{ question: 1 }],
                    toc: [{ id: 2 }],
                    sources: 'none',
                }),
                version(ids[1], good),
            ],
        });

        const answer = await getPages(request('/pages'), 'site');
        const body = await answer.json();

        expect(answer.status).toBe(200);

        expect(
            body.pages.map(
                ({ faq, toc, sources }: Record<string, unknown>) => ({
                    faq,
                    toc,
                    sources,
                }),
            ),
        ).toEqual([{ faq: [], toc: [], sources: [] }, good]);
    });

    it('names every parameter of /pages, a sync included, when a request sends one it does not take', async () => {
        database();

        const answer = await getPages(request('/pages?colour=red'), 'site');

        expect((await answer.json()).detail).toBe(
            'The endpoint takes no parameter colour. It takes locale, kind, sync, updatedSince, limit and cursor.',
        );
    });

    it('answers 400 for a locale filter that is neither a language nor a language and a country', async () => {
        const fake = database();

        for (const locale of ['en-US-x-foo', 'pl-xyz', 'zh-Hant-TW']) {
            const answer = await getPages(
                request(`/pages?locale=${locale}`),
                'site',
            );

            expect(answer.status).toBe(400);
            expect((await answer.json()).code).toBe('invalid_parameter');
        }

        expect(queryNames(fake)).not.toContain('api_pages');
    });

    it('answers 400 for an unknown or malformed parameter', async () => {
        database();

        for (const query of ['?limt=5', '?limit=0', '?limit=1&limit=2']) {
            const answer = await getPages(request(`/pages${query}`), 'site');

            expect(answer.status).toBe(400);
            expect((await answer.json()).code).toBe('invalid_parameter');
        }
    });

    it('refuses a cursor made for other filters', async () => {
        database();

        const cursor = encodeCursor(
            'pages',
            { key: '2026-10-01T08:00:00+00:00', id: ids[0] },
            { locale: 'pl', kind: null },
        );

        const answer = await getPages(
            request(`/pages?locale=en&cursor=${cursor}`),
            'site',
        );

        expect(answer.status).toBe(400);
        expect((await answer.json()).code).toBe('invalid_cursor');
    });

    it('refuses a cursor whose time Postgres would refuse, before asking for the pages', async () => {
        const fake = database();

        const cursor = Buffer.from(
            JSON.stringify(['pages', '9999-99-99T99:99:99Z', ids[0], {}]),
        ).toString('base64url');

        const answer = await getPages(
            request(`/pages?cursor=${cursor}`),
            'site',
        );

        expect(answer.status).toBe(400);
        expect((await answer.json()).code).toBe('invalid_cursor');
        expect(queryNames(fake)).not.toContain('api_pages');
    });

    it('answers 304 with the same ETag when If-None-Match matches', async () => {
        database({ api_pages: [version(ids[0])] });

        const first = await getPages(request('/pages'), 'site');
        const etag = first.headers.get('ETag') ?? '';

        const second = await getPages(
            request('/pages', { 'If-None-Match': etag }),
            'site',
        );

        expect(second.status).toBe(304);
        expect(second.headers.get('ETag')).toBe(etag);
        expect(second.headers.get('Cache-Control')).toBe('private, no-cache');
        expect(await second.text()).toBe('');
    });
});

describe('the sync', () => {
    it('refuses a locale or kind filter', async () => {
        database();

        const answer = await getPages(
            request('/pages?sync=start&locale=pl'),
            'site',
        );

        expect(answer.status).toBe(400);
        expect((await answer.json()).code).toBe('invalid_parameter');
    });

    it('gives a page object for a live page, a removal record for an unpublished one, and a token on the last page', async () => {
        const fake = database({
            api_sync: [
                version(ids[0]),
                version(ids[1], {
                    status: 'unpublished',
                    unpublished_at: '2026-10-04T10:00:00+00:00',
                    redirect_to: 'https://acme.com/pricing',
                }),
            ],
        });

        const answer = await getPages(request('/pages?sync=start'), 'site');
        const body = await answer.json();

        expect(rpcArgs(fake, 'api_sync')).toMatchObject({
            since: '1970-01-01T00:00:00.000Z',
        });

        expect(
            body.pages.map((page: { status: string }) => page.status),
        ).toEqual(['published', 'unpublished']);

        expect(body.pages[1].redirect).toEqual({
            status: 301,
            to: 'https://acme.com/pricing',
        });

        expect(body.nextCursor).toBeNull();
        expect(decodeSyncToken(body.nextSyncToken, Date.now())).not.toBeNull();
    });

    it('starts from updatedSince in any offset', async () => {
        const fake = database();

        await getPages(
            request('/pages?updatedSince=2026-10-15T08:12:00%2B02:00'),
            'site',
        );

        expect(rpcArgs(fake, 'api_sync')).toMatchObject({
            since: '2026-10-15T06:12:00.000Z',
        });
    });

    it("gives a token 5 seconds before the cached read's own time, never the request's clock", async () => {
        database();

        vi.mocked(readSync).mockResolvedValueOnce({
            readAt: '2026-10-10T08:00:00.000Z',
            items: [],
            last: null,
        });

        const answer = await getPages(request('/pages?sync=start'), 'site');
        const { nextSyncToken } = await answer.json();

        expect(
            decodeSyncToken(nextSyncToken, Date.parse('2026-10-10T08:00:00Z')),
        ).toBe('2026-10-10T07:59:55.000Z');
    });

    it('answers 400 for an updatedSince after year 9999', async () => {
        const fake = database();

        const answer = await getPages(
            request('/pages?updatedSince=9999-12-31T23:59:59-23:59'),
            'site',
        );

        expect(answer.status).toBe(400);
        expect(queryNames(fake)).not.toContain('api_sync');
    });

    it('answers 410 sync_token_invalid for what is not a token', async () => {
        database();

        const answer = await getPages(request('/pages?sync=nonsense'), 'site');

        expect(answer.status).toBe(410);
        expect((await answer.json()).code).toBe('sync_token_invalid');
    });
});

describe('one page', () => {
    it('answers a live page with Last-Modified from its published version', async () => {
        const fake = database({ api_page: [version(ids[0])] });

        const answer = await getPage(
            request('/pages/PL/deload'),
            'site',
            'PL',
            'deload',
        );

        expect(answer.status).toBe(200);
        expect(rpcArgs(fake, 'api_page')).toMatchObject({ page_locale: 'pl' });

        expect(answer.headers.get('Last-Modified')).toBe(
            'Sat, 03 Oct 2026 10:00:00 GMT',
        );

        expect((await answer.json()).id).toBe(ids[0]);
    });

    it('answers an unpublished page with 410 and its redirect', async () => {
        database({
            api_page: [
                version(ids[0], {
                    status: 'unpublished',
                    unpublished_at: '2026-10-04T10:00:00+00:00',
                }),
            ],
        });

        const answer = await getPage(
            request('/pages/pl/deload'),
            'site',
            'pl',
            'deload',
        );

        expect(answer.status).toBe(410);

        expect(await answer.json()).toMatchObject({
            code: 'page_unpublished',
            redirect: null,
        });
    });

    it('answers 404 for a page never published', async () => {
        database();

        const answer = await getPage(request('/pages/pl/x'), 'site', 'pl', 'x');

        expect(answer.status).toBe(404);
        expect((await answer.json()).code).toBe('page_not_found');
    });
});

describe('the redirects', () => {
    it('lists removal records, 500 by default, with a cursor to the next page', async () => {
        const fake = database({
            api_redirects: [
                {
                    id: ids[0],
                    locale: 'pl',
                    path: '/blog/deload',
                    url: 'https://acme.com/blog/deload',
                    unpublished_at: '2026-10-04T10:00:00.123456+00:00',
                    redirect_to: 'https://acme.com/pricing',
                },
            ],
        });

        const answer = await getRedirects(request('/redirects'), 'site');

        expect(rpcArgs(fake, 'api_redirects')).toMatchObject({
            page_limit: 501,
        });

        expect(await answer.json()).toEqual({
            redirects: [
                {
                    id: ids[0],
                    locale: 'pl',
                    path: '/blog/deload',
                    url: 'https://acme.com/blog/deload',
                    status: 'unpublished',
                    unpublishedAt: '2026-10-04T10:00:00.123Z',
                    redirect: { status: 301, to: 'https://acme.com/pricing' },
                },
            ],
            nextCursor: null,
        });
    });

    it('takes a cursor of its own and refuses one of the list', async () => {
        const fake = database();
        const position = { key: '2026-10-04T10:00:00+00:00', id: ids[0] };

        await getRedirects(
            request(
                `/redirects?cursor=${encodeCursor('redirects', position, {})}`,
            ),
            'site',
        );

        expect(rpcArgs(fake, 'api_redirects')).toMatchObject({
            after_unpublished_at: position.key,
            after_id: position.id,
        });

        const answer = await getRedirects(
            request(`/redirects?cursor=${encodeCursor('pages', position, {})}`),
            'site',
        );

        expect((await answer.json()).code).toBe('invalid_cursor');
    });
});

describe('the JSON sitemap', () => {
    it('lists the URLs, 500 by default, with lastmod and alternates', async () => {
        const fake = database({ api_sitemap: [version(ids[0])] });

        const answer = await getSitemap(request('/sitemap'), 'site');

        expect(rpcArgs(fake, 'api_sitemap')).toMatchObject({ page_limit: 501 });

        expect(await answer.json()).toEqual({
            urls: [
                {
                    url: 'https://acme.com/blog/deload',
                    lastmod: '2026-10-02T09:30:00.000Z',
                    alternates: [
                        { hreflang: 'pl', url: 'https://acme.com/blog/deload' },
                        {
                            hreflang: 'x-default',
                            url: 'https://acme.com/blog/deload',
                        },
                    ],
                },
            ],
            nextCursor: null,
        });
    });

    it('lowers a limit over 1 000 and takes a cursor of its own', async () => {
        const fake = database();
        const position = { key: '2026-10-01T08:00:00+00:00', id: ids[0] };

        await getSitemap(
            request(
                `/sitemap?limit=5000&cursor=${encodeCursor('sitemap', position, {})}`,
            ),
            'site',
        );

        expect(rpcArgs(fake, 'api_sitemap')).toMatchObject({
            page_limit: 1_000,
            after_published_at: position.key,
        });
    });
});

describe('the XML sitemap', () => {
    function sitemapRequest(path: string) {
        return new NextRequest(
            `https://citequill.com/api/v1/sites/site/sitemaps/${path}`,
        );
    }

    it('answers 404 site_not_found when no project has the site id', async () => {
        database({ api_sitemap_project: null, api_site_exists: false });

        const answer = await getHostSitemap(
            sitemapRequest('acme.com.xml'),
            'site',
            'acme.com.xml',
        );

        expect(answer.status).toBe(404);
        expect((await answer.json()).code).toBe('site_not_found');
    });

    it('answers 404 host_not_found when the host is not among the locales', async () => {
        database({ api_sitemap_project: null, api_site_exists: true });

        const answer = await getHostSitemap(
            sitemapRequest('other.com.xml'),
            'site',
            'other.com.xml',
        );

        expect(answer.status).toBe(404);
        expect((await answer.json()).code).toBe('host_not_found');
    });

    it('answers an empty urlset for a host with no live page, with no key', async () => {
        database({ api_sitemap_project: 'project', api_host_sitemap: [] });

        const answer = await getHostSitemap(
            sitemapRequest('acme.com.xml'),
            'site',
            'acme.com.xml',
        );

        expect(answer.status).toBe(200);

        expect(answer.headers.get('Content-Type')).toBe(
            'application/xml; charset=utf-8',
        );

        expect(await answer.text()).toContain('<urlset');
    });

    it("answers an index of the host's files when one file cannot hold its pages", async () => {
        const long = `https://acme.com/${'a'.repeat(2_100_000)}`;

        database({
            api_sitemap_project: 'project',
            api_host_sitemap: [
                version(ids[0], { url: long, alternates: [] }),
                version(ids[1], { url: `${long}b`, alternates: [] }),
            ],
        });

        const answer = await getHostSitemap(
            sitemapRequest('acme.com.xml'),
            'site',
            'acme.com.xml',
        );

        const xml = await answer.text();

        expect(xml).toContain('<sitemapindex');

        expect(xml).toContain(
            '<loc>https://citequill.com/api/v1/sites/site/sitemaps/acme.com/1.xml</loc>',
        );

        expect(xml).toContain(
            '<loc>https://citequill.com/api/v1/sites/site/sitemaps/acme.com/2.xml</loc>',
        );
    });

    it('answers file 1 of a host that fits one file and 404 past it', async () => {
        database({
            api_sitemap_project: 'project',
            api_host_sitemap: [version(ids[0])],
        });

        const first = await getSitemapFile(
            sitemapRequest('acme.com/1.xml'),
            'site',
            'acme.com',
            '1.xml',
        );

        const second = await getSitemapFile(
            sitemapRequest('acme.com/2.xml'),
            'site',
            'acme.com',
            '2.xml',
        );

        expect(await first.text()).toContain(
            '<loc>https://acme.com/blog/deload</loc>',
        );

        expect(second.status).toBe(404);
        expect((await second.json()).code).toBe('sitemap_not_found');
    });
});

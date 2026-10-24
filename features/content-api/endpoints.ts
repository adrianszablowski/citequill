import 'server-only';

import type { NextRequest } from 'next/server';

import {
    answered,
    jsonAnswer,
    nextLink,
    problem,
    xmlAnswer,
} from '@/features/content-api/answer';
import { type Access, authorize } from '@/features/content-api/auth';
import { parseRfc3339 } from '@/features/content-api/dates';
import {
    decodeCursor,
    decodeSyncToken,
    encodeCursor,
    encodeSyncToken,
    type Endpoint,
    type Filters,
    longLimits,
    pageLimits,
    parseLimit,
    type Position,
    syncStart,
} from '@/features/content-api/paging';
import { isLocale, readQuery } from '@/features/content-api/query';
import {
    readHostSitemap,
    readPage,
    readPages,
    readRedirects,
    readSitemap,
    readSiteExists,
    readSitemapProject,
    readSync,
} from '@/features/content-api/reads';
import { sitemapFiles, sitemapIndex } from '@/features/content-api/sitemap-xml';
import { canonicalLocale } from '@/features/crawl/locales';
import { formatCount } from '@/lib/utils';

export const getPages = answered(
    async (request: NextRequest, siteId: string) => {
        const access = await authorize(request, siteId);

        if (access instanceof Response) {
            return access;
        }

        const { searchParams } = request.nextUrl;

        if (!searchParams.has('sync') && !searchParams.has('updatedSince')) {
            return listPages(request, access);
        }

        if (searchParams.has('locale') || searchParams.has('kind')) {
            return problem(
                'invalid_parameter',
                'A sync takes no locale or kind filter. It returns every page that changed.',
            );
        }

        return syncPages(request, access);
    },
);

export const getPage = answered(
    async (
        request: NextRequest,
        siteId: string,
        locale: string,
        slug: string,
    ) => {
        const access = await authorize(request, siteId);

        if (access instanceof Response) {
            return access;
        }

        const query = readQuery(request.nextUrl, []);

        if (query instanceof Response) {
            return query;
        }

        const found = await readPage(access, canonicalLocale(locale), slug);

        if (!found) {
            return problem('page_not_found');
        }

        if (found.removal) {
            return problem('page_unpublished', undefined, {
                redirect: found.removal.redirect,
            });
        }

        return jsonAnswer(request, found.page, {
            'Last-Modified': new Date(found.updatedAt).toUTCString(),
        });
    },
);

export const getRedirects = answered(
    async (request: NextRequest, siteId: string) => {
        const access = await authorize(request, siteId);

        if (access instanceof Response) {
            return access;
        }

        const query = readQuery(request.nextUrl, ['limit', 'cursor']);

        if (query instanceof Response) {
            return query;
        }

        const limit = parseLimit(query.limit, longLimits);

        if (limit === null) {
            return problem('invalid_parameter', limitDetail(longLimits.max));
        }

        const after = readCursor(query.cursor, 'redirects', {});

        if (after instanceof Response) {
            return after;
        }

        const { items, last } = await readRedirects(access, after, limit);

        return listed(request, { redirects: items }, 'redirects', last, {});
    },
);

export const getSitemap = answered(
    async (request: NextRequest, siteId: string) => {
        const access = await authorize(request, siteId);

        if (access instanceof Response) {
            return access;
        }

        const query = readQuery(request.nextUrl, ['limit', 'cursor']);

        if (query instanceof Response) {
            return query;
        }

        const limit = parseLimit(query.limit, longLimits);

        if (limit === null) {
            return problem('invalid_parameter', limitDetail(longLimits.max));
        }

        const after = readCursor(query.cursor, 'sitemap', {});

        if (after instanceof Response) {
            return after;
        }

        const { items, last } = await readSitemap(access, after, limit);

        return listed(request, { urls: items }, 'sitemap', last, {});
    },
);

export const getHostSitemap = answered(
    async (request: NextRequest, siteId: string, file: string) => {
        const host = /^(.+)\.xml$/.exec(file)?.[1];

        if (!host) {
            return problem('host_not_found');
        }

        const files = await hostFiles(request, siteId, host);

        if (files instanceof Response) {
            return files;
        }

        if (files.length === 1) {
            return xmlAnswer(request, files[0]);
        }

        return xmlAnswer(
            request,
            sitemapIndex(
                files.map((_, index) =>
                    new URL(`${host}/${index + 1}.xml`, request.url).toString(),
                ),
            ),
        );
    },
);

export const getSitemapFile = answered(
    async (
        request: NextRequest,
        siteId: string,
        host: string,
        file: string,
    ) => {
        const files = await hostFiles(request, siteId, host);

        if (files instanceof Response) {
            return files;
        }

        const number = /^([1-9]\d*)\.xml$/.exec(file)?.[1];
        const found = number && files[Number(number) - 1];

        return found ? xmlAnswer(request, found) : problem('sitemap_not_found');
    },
);

async function listPages(request: NextRequest, access: Access) {
    const query = readQuery(
        request.nextUrl,
        ['locale', 'kind', 'limit', 'cursor'],
        pagesParameters,
    );

    if (query instanceof Response) {
        return query;
    }

    const limit = parseLimit(query.limit, pageLimits);

    if (limit === null) {
        return problem('invalid_parameter', limitDetail(pageLimits.max));
    }

    if (query.locale !== undefined && !isLocale(query.locale)) {
        return problem(
            'invalid_parameter',
            'locale takes a language, or a language and a two-letter country, such as pl or en-US.',
        );
    }

    const locale =
        query.locale === undefined ? null : canonicalLocale(query.locale);

    const filters = { locale, kind: query.kind ?? null };
    const after = readCursor(query.cursor, 'pages', filters);

    if (after instanceof Response) {
        return after;
    }

    const { items, last } = await readPages(access, filters, after, limit);

    return listed(request, { pages: items }, 'pages', last, filters);
}

async function syncPages(request: NextRequest, access: Access) {
    const query = readQuery(
        request.nextUrl,
        ['sync', 'updatedSince', 'limit', 'cursor'],
        pagesParameters,
    );

    if (query instanceof Response) {
        return query;
    }

    if (query.sync !== undefined && query.updatedSince !== undefined) {
        return problem(
            'invalid_parameter',
            'Send either sync or updatedSince. A sync token already holds its date.',
        );
    }

    const limit = parseLimit(query.limit, pageLimits);

    if (limit === null) {
        return problem('invalid_parameter', limitDetail(pageLimits.max));
    }

    const since = syncSince(query);

    if (since instanceof Response) {
        return since;
    }

    const after = readCursor(query.cursor, 'sync', { since });

    if (after instanceof Response) {
        return after;
    }

    const { items, last, readAt } = await readSync(access, since, after, limit);

    return listed(
        request,
        { pages: items },
        'sync',
        last,
        { since },
        {
            nextSyncToken: last ? null : encodeSyncToken(readAt),
        },
    );
}

function syncSince(query: Record<string, string>) {
    if (query.updatedSince !== undefined) {
        return (
            parseRfc3339(query.updatedSince) ??
            problem(
                'invalid_parameter',
                'updatedSince takes an RFC 3339 date with an offset, such as 2026-10-15T06:12:00Z. Send a + in it as %2B.',
            )
        );
    }

    if (query.sync === 'start') {
        return syncStart;
    }

    return (
        decodeSyncToken(query.sync, Date.now()) ?? problem('sync_token_invalid')
    );
}

function readCursor(
    value: string | undefined,
    endpoint: Endpoint,
    filters: Filters,
) {
    if (value === undefined) {
        return null;
    }

    return decodeCursor(value, endpoint, filters) ?? problem('invalid_cursor');
}

function listed(
    request: NextRequest,
    body: Record<string, unknown>,
    endpoint: Endpoint,
    last: Position | null,
    filters: Filters,
    extra: Record<string, unknown> = {},
) {
    const nextCursor = last && encodeCursor(endpoint, last, filters);

    return jsonAnswer(
        request,
        { ...body, nextCursor, ...extra },
        nextCursor ? nextLink(request, nextCursor) : {},
    );
}

async function hostFiles(request: NextRequest, siteId: string, host: string) {
    const query = readQuery(request.nextUrl, []);

    if (query instanceof Response) {
        return query;
    }

    const projectId = await readSitemapProject(siteId, host);

    if (!projectId) {
        return problem(
            (await readSiteExists(siteId))
                ? 'host_not_found'
                : 'site_not_found',
        );
    }

    return sitemapFiles(
        await readHostSitemap(projectId, siteId, host.toLowerCase()),
    );
}

function limitDetail(max: number) {
    return `limit takes a whole number from 1. A number over ${formatCount(max)} counts as ${formatCount(max)}.`;
}

const pagesParameters = [
    'locale',
    'kind',
    'sync',
    'updatedSince',
    'limit',
    'cursor',
];

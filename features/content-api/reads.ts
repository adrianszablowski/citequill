import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Access } from '@/features/content-api/auth';
import {
    apiCacheLife,
    apiCacheTag,
    orUncached,
} from '@/features/content-api/cache';
import {
    pageObject,
    publisherOf,
    removalRecord,
    sitemapItem,
} from '@/features/content-api/page-object';
import {
    type Filters,
    pageOf,
    type Position,
    rowLimit,
} from '@/features/content-api/paging';
import {
    redirectRow,
    sitemapRow,
    siteRow,
    versionRow,
} from '@/features/content-api/rows';
import { createAdminClient } from '@/lib/supabase/admin';
import { one } from '@/lib/supabase/result';

export const readPages = orUncached(cachedPages, pagesFrom);

export const readPage = orUncached(cachedPage, pageFrom);

export const readSync = orUncached(cachedSync, syncFrom);

export const readRedirects = orUncached(cachedRedirects, redirectsFrom);

export const readSitemap = orUncached(cachedSitemap, sitemapFrom);

export const readHostSitemap = orUncached(cachedHostSitemap, hostSitemapFrom);

export async function readSitemapProject(siteId: string, host: string) {
    const { data, error } = await createAdminClient().rpc(
        'api_sitemap_project',
        { site: siteId, sitemap_host: host },
    );

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

export async function readSiteExists(siteId: string) {
    return one(createAdminClient().rpc('api_site_exists', { site: siteId }));
}

async function cachedPages(...args: Parameters<typeof pagesFrom>) {
    'use cache: remote';

    cacheLife(apiCacheLife);
    cacheTag(apiCacheTag(args[0].projectId));

    return pagesFrom(...args);
}

async function pagesFrom(
    { hash, siteId }: Access,
    filters: Filters,
    after: Position | null,
    limit: number,
) {
    const [publisher, rows] = await Promise.all([
        readPublisher(hash, siteId),
        one(
            createAdminClient().rpc('api_pages', {
                secret_hash: hash,
                site: siteId,
                page_locale: filters.locale ?? undefined,
                kind_name: filters.kind ?? undefined,
                after_published_at: after?.key,
                after_id: after?.id,
                page_limit: rowLimit(limit),
            }),
        ),
    ]);

    const page = pageOf(
        rows.map((row) => versionRow.parse(row)),
        limit,
    );

    return {
        items: page.rows.map((row) => pageObject(row, publisher)),
        last: page.last && { key: page.last.published_at, id: page.last.id },
    };
}

async function cachedPage(...args: Parameters<typeof pageFrom>) {
    'use cache: remote';

    cacheLife(apiCacheLife);
    cacheTag(apiCacheTag(args[0].projectId));

    return pageFrom(...args);
}

async function pageFrom(
    { hash, siteId }: Access,
    locale: string,
    slug: string,
) {
    const [publisher, [found]] = await Promise.all([
        readPublisher(hash, siteId),
        one(
            createAdminClient().rpc('api_page', {
                secret_hash: hash,
                site: siteId,
                page_locale: locale,
                page_slug: slug,
            }),
        ),
    ]);

    if (!found) {
        return null;
    }

    const row = versionRow.parse(found);

    return row.status === 'published'
        ? {
              page: pageObject(row, publisher),
              updatedAt: row.updated_at,
          }
        : { removal: removalRecord(redirectRow.parse(row)) };
}

async function cachedSync(...args: Parameters<typeof syncFrom>) {
    'use cache: remote';

    cacheLife(apiCacheLife);
    cacheTag(apiCacheTag(args[0].projectId));

    return syncFrom(...args);
}

async function syncFrom(
    { hash, siteId }: Access,
    since: string,
    after: Position | null,
    limit: number,
) {
    const readAt = new Date().toISOString();

    const [publisher, rows] = await Promise.all([
        readPublisher(hash, siteId),
        one(
            createAdminClient().rpc('api_sync', {
                secret_hash: hash,
                site: siteId,
                since,
                after_updated_at: after?.key,
                after_id: after?.id,
                page_limit: rowLimit(limit),
            }),
        ),
    ]);

    const page = pageOf(
        rows.map((row) => versionRow.parse(row)),
        limit,
    );

    return {
        readAt,
        items: page.rows.map((row) =>
            row.status === 'published'
                ? pageObject(row, publisher)
                : removalRecord(redirectRow.parse(row)),
        ),
        last: page.last && { key: page.last.updated_at, id: page.last.id },
    };
}

async function cachedRedirects(...args: Parameters<typeof redirectsFrom>) {
    'use cache: remote';

    cacheLife(apiCacheLife);
    cacheTag(apiCacheTag(args[0].projectId));

    return redirectsFrom(...args);
}

async function redirectsFrom(
    { hash, siteId }: Access,
    after: Position | null,
    limit: number,
) {
    const rows = await one(
        createAdminClient().rpc('api_redirects', {
            secret_hash: hash,
            site: siteId,
            after_unpublished_at: after?.key,
            after_id: after?.id,
            page_limit: rowLimit(limit),
        }),
    );

    const page = pageOf(
        rows.map((row) => redirectRow.parse(row)),
        limit,
    );

    return {
        items: page.rows.map(removalRecord),
        last: page.last && { key: page.last.unpublished_at, id: page.last.id },
    };
}

async function cachedSitemap(...args: Parameters<typeof sitemapFrom>) {
    'use cache: remote';

    cacheLife(apiCacheLife);
    cacheTag(apiCacheTag(args[0].projectId));

    return sitemapFrom(...args);
}

async function sitemapFrom(
    { hash, siteId }: Access,
    after: Position | null,
    limit: number,
) {
    const rows = await one(
        createAdminClient().rpc('api_sitemap', {
            secret_hash: hash,
            site: siteId,
            after_published_at: after?.key,
            after_id: after?.id,
            page_limit: rowLimit(limit),
        }),
    );

    const page = pageOf(
        rows.map((row) => sitemapRow.parse(row)),
        limit,
    );

    return {
        items: page.rows.map(sitemapItem),
        last: page.last && { key: page.last.published_at, id: page.last.id },
    };
}

async function cachedHostSitemap(...args: Parameters<typeof hostSitemapFrom>) {
    'use cache: remote';

    cacheLife(apiCacheLife);
    cacheTag(apiCacheTag(args[0]));

    return hostSitemapFrom(...args);
}

async function hostSitemapFrom(
    projectId: string,
    siteId: string,
    host: string,
) {
    const items = [];
    let after: Position | null = null;

    do {
        const page = await readHostPage(siteId, host, after);

        items.push(...page.items);
        after = page.last;
    } while (after);

    return items;
}

async function readHostPage(
    siteId: string,
    host: string,
    after: Position | null,
) {
    const rows = await one(
        createAdminClient().rpc('api_host_sitemap', {
            site: siteId,
            sitemap_host: host,
            after_published_at: after?.key,
            after_id: after?.id,
            page_limit: hostRows,
        }),
    );

    const page = pageOf(
        rows.map((row) => sitemapRow.parse(row)),
        hostRows,
    );

    return {
        items: page.rows.map(sitemapItem),
        last: page.last && { key: page.last.published_at, id: page.last.id },
    };
}

async function readPublisher(hash: string, siteId: string) {
    const [site] = await one(
        createAdminClient().rpc('api_site', {
            secret_hash: hash,
            site: siteId,
        }),
    );

    return publisherOf(siteRow.parse(site));
}

const hostRows = 1_000;

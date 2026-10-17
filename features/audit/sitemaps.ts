import type { SiteClient } from '@/features/audit/client';
import { hasStopped } from '@/features/audit/pacing';
import { linkTarget } from '@/features/audit/queue';
import type { Fetched } from '@/features/crawl/fetch';
import {
    emptySitemap,
    readSitemap,
    type Sitemap,
} from '@/features/crawl/sitemap';

export interface SitemapFile {
    url: string;
    fetched: Fetched | Error | null;
    sitemap: Sitemap;
}

export const sitemapCap = 50;

export async function readSitemaps(
    client: SiteClient,
    urls: string[],
    hosts: string[],
) {
    const pending = urls.flatMap((url) => linkTarget(url, hosts) ?? []);
    const files: SitemapFile[] = [];

    for (
        let url = pending.shift();
        url && files.length < sitemapCap;
        url = pending.shift()
    ) {
        if (files.some((file) => file.url === url)) {
            continue;
        }

        const fetched = await client.read(url);

        if (fetched === null || hasStopped(client.pace())) {
            break;
        }

        const sitemap =
            fetched instanceof Error || !fetched.ok
                ? emptySitemap
                : readSitemap(fetched.body);

        files.push({ url, fetched, sitemap });

        pending.push(
            ...sitemap.sitemaps.flatMap(
                ({ loc }) => linkTarget(loc, hosts) ?? [],
            ),
        );
    }

    return files;
}

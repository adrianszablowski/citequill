import type { Finding } from '@/features/audit/finding';
import type { SitemapFile } from '@/features/audit/sitemaps';
import type { Fetched } from '@/features/crawl/fetch';

export interface SitemapContext {
    named: string[];
    now: number;
}

export const sitemapNamespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';

export const sitemapEntryCap = 50_000;

export const sitemapByteCap = 50 * 1024 * 1024;

export const locLengthCap = 2_048;

export const imagesPerUrlCap = 1_000;

export const lastmodSample = 10;

export const identicalLastmodShare = 0.9;

export function sitemapChecks(
    files: SitemapFile[],
    { named, now }: SitemapContext,
): Finding[] {
    const listed = new Set(
        [
            ...named,
            ...files.flatMap((file) =>
                file.sitemap.sitemaps.map((child) => child.loc),
            ),
        ].map(normalized),
    );

    const answered = files.flatMap((file) => {
        const fetched = answer(file);

        return fetched && (file.sitemap.root || listed.has(file.url))
            ? [{ file, fetched }]
            : [];
    });

    return [
        ...(named.length === 0
            ? [{ check: 'sitemap-not-in-robots', url: null } as const]
            : []),
        ...(named.length === 0 && answered.length === 0
            ? [{ check: 'sitemap-missing', url: null } as const]
            : []),
        ...files.filter((file) => listed.has(file.url)).flatMap(unreachable),
        ...answered.flatMap(({ file, fetched }) => [
            ...limits(file, fetched),
            ...invalid(file, fetched),
            ...scope(file),
            ...lastmod(file, now),
            ...priority(file),
            ...extensions(file),
        ]),
    ];
}

const w3cDate =
    /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

const dayMs = 86_400_000;

const deprecatedImageTags = ['caption', 'geo_location', 'title', 'license'];

const requiredVideoTags = ['thumbnail_loc', 'title', 'description'];

function answer({ fetched }: SitemapFile) {
    return fetched instanceof Error || fetched?.status !== 200 ? null : fetched;
}

function normalized(href: string) {
    try {
        const url = new URL(href);

        url.hash = '';

        return url.href;
    } catch {
        return href;
    }
}

function unreachable({ url, fetched }: SitemapFile): Finding[] {
    const site = {
        check: 'sitemap-unreachable',
        url: null,
        subject: url,
    } as const;

    if (fetched instanceof Error || fetched === null) {
        return [{ ...site, detail: { error: fetched?.message ?? null } }];
    }

    if (fetched.status !== 200) {
        return [{ ...site, detail: { status: fetched.status } }];
    }

    return new URL(fetched.url).hostname === new URL(url).hostname
        ? []
        : [{ ...site, detail: { redirectedTo: fetched.url } }];
}

function limits({ url, sitemap }: SitemapFile, fetched: Fetched): Finding[] {
    const bytes = Number(fetched.headers.get('content-length') ?? 0);

    return sitemap.urls.length > sitemapEntryCap ||
        sitemap.sitemaps.length > sitemapEntryCap ||
        bytes > sitemapByteCap
        ? [
              {
                  check: 'sitemap-limits',
                  url: null,
                  subject: url,
                  detail: {
                      urls: sitemap.urls.length,
                      sitemaps: sitemap.sitemaps.length,
                      bytes,
                  },
              },
          ]
        : [];
}

function invalid({ url, sitemap }: SitemapFile, fetched: Fetched): Finding[] {
    const long = [...sitemap.urls, ...sitemap.sitemaps].filter(
        (entry) => entry.loc.length > locLengthCap,
    );

    const problems = [
        ...(sitemap.root || fetched.isTruncated ? [] : ['not a sitemap']),
        ...(sitemap.isWellFormed || fetched.isTruncated
            ? []
            : ['not well-formed XML']),
        ...(sitemap.root && sitemap.namespace !== sitemapNamespace
            ? ['wrong namespace']
            : []),
        ...(sitemap.rejected.length > 0 ? ['relative <loc>'] : []),
        ...(long.length > 0 ? [`<loc> over ${locLengthCap} characters`] : []),
    ];

    return problems.length > 0
        ? [
              {
                  check: 'sitemap-invalid',
                  url: null,
                  subject: url,
                  detail: {
                      problems,
                      namespace: sitemap.namespace,
                      rejected: sitemap.rejected.slice(0, 5),
                  },
              },
          ]
        : [];
}

function scope({ url, sitemap }: SitemapFile): Finding[] {
    const base = new URL(url);
    const folder = base.pathname.slice(0, base.pathname.lastIndexOf('/') + 1);

    const outside = sitemap.urls.filter(({ loc }) => {
        const entry = URL.parse(loc);

        return (
            entry?.protocol !== base.protocol ||
            entry.host !== base.host ||
            !entry.pathname.startsWith(folder)
        );
    });

    return outside.length > 0
        ? [
              {
                  check: 'sitemap-scope',
                  url: null,
                  subject: url,
                  detail: {
                      count: outside.length,
                      examples: outside.slice(0, 5).map(({ loc }) => loc),
                  },
              },
          ]
        : [];
}

function lastmod({ url, sitemap }: SitemapFile, now: number): Finding[] {
    const dates = [...sitemap.urls, ...sitemap.sitemaps].flatMap((entry) =>
        entry.lastmod ? [entry.lastmod] : [],
    );

    const malformed = dates.filter((date) => !w3cDate.test(date));

    const future = dates.filter(
        (date) => w3cDate.test(date) && Date.parse(date) > now + dayMs,
    );

    const counts = new Map<string, number>();

    for (const date of dates) {
        counts.set(date, (counts.get(date) ?? 0) + 1);
    }

    const identical = Math.max(0, ...counts.values()) / (dates.length || 1);

    const isIdentical =
        dates.length >= lastmodSample && identical > identicalLastmodShare;

    return malformed.length > 0 || future.length > 0 || isIdentical
        ? [
              {
                  check: 'sitemap-lastmod',
                  url: null,
                  subject: url,
                  detail: {
                      malformed: malformed.slice(0, 5),
                      future: future.slice(0, 5),
                      identicalShare: isIdentical ? identical : null,
                  },
              },
          ]
        : [];
}

function priority({ url, sitemap }: SitemapFile): Finding[] {
    const marked = sitemap.urls.filter(
        (entry) => entry.priority !== null || entry.changefreq !== null,
    );

    return marked.length > 0
        ? [
              {
                  check: 'sitemap-priority',
                  url: null,
                  subject: url,
                  detail: { count: marked.length },
              },
          ]
        : [];
}

function extensions({ url, sitemap }: SitemapFile): Finding[] {
    const crowded = sitemap.urls.filter(
        (entry) => entry.images.length > imagesPerUrlCap,
    );

    const deprecated = sitemap.urls.filter((entry) =>
        entry.images.some((image) =>
            deprecatedImageTags.some((tag) => tag in image),
        ),
    );

    const incomplete = sitemap.urls.filter((entry) =>
        entry.videos.some(
            (video) =>
                requiredVideoTags.some((tag) => !(tag in video)) ||
                !('content_loc' in video || 'player_loc' in video),
        ),
    );

    const faulty = [...crowded, ...deprecated, ...incomplete];

    return faulty.length > 0
        ? [
              {
                  check: 'sitemap-extensions',
                  url: null,
                  subject: url,
                  detail: {
                      overImageCap: crowded.length,
                      deprecatedImageTags: deprecated.length,
                      incompleteVideos: incomplete.length,
                      example: faulty[0].loc,
                  },
              },
          ]
        : [];
}

import { apiDate } from '@/features/content-api/dates';
import type {
    RedirectRow,
    SitemapRow,
    SiteRow,
    VersionRow,
} from '@/features/content-api/rows';
import { pagePath } from '@/features/pages/draft';
import { cleanMarkdown } from '@/features/pages/render';
import { organizationDefaults } from '@/features/publishing/organization';

export type Publisher = ReturnType<typeof publisherOf>;

export function publisherOf(site: SiteRow) {
    const defaults = organizationDefaults(site.project_name, site.locales);

    return {
        name: site.organization_name || defaults.name,
        url: site.organization_url || defaults.url,
        logo:
            site.organization_logo_url &&
            site.organization_logo_width &&
            site.organization_logo_height
                ? {
                      url: site.organization_logo_url,
                      width: site.organization_logo_width,
                      height: site.organization_logo_height,
                  }
                : null,
        sameAs: site.organization_same_as,
    };
}

export function pageObject(row: VersionRow, publisher: Publisher) {
    const ogLocale = row.locale.replace('-', '_');
    const publishedAt = apiDate(row.published_at);
    const updatedAt = apiDate(row.modified_at);

    const author = row.author_name
        ? {
              name: row.author_name,
              jobTitle: row.author_title || null,
              url: row.author_url || null,
              sameAs: row.author_same_as ?? [],
          }
        : null;

    const breadcrumbs = [
        ...(row.locale_base_url
            ? [{ name: publisher.name, url: row.locale_base_url }]
            : []),
        ...(row.locale_base_url && row.kind && hasPrefix(row.kind_url_prefix)
            ? [
                  {
                      name: row.kind,
                      url: pagePath(
                          row.locale_base_url,
                          row.kind_url_prefix ?? '',
                          '',
                      ),
                  },
              ]
            : []),
        { name: row.title, url: row.url },
    ];

    return {
        id: row.id,
        status: 'published' as const,
        kind: row.kind,
        locale: row.locale,
        hreflang: row.locale,
        ogLocale,
        slug: row.slug,
        path: row.path,
        url: row.url,
        canonical: row.url,
        alternates: alternatesOf(row.alternates),
        title: row.title,
        metaTitle: row.meta_title,
        metaDescription: row.meta_description,
        excerpt: row.excerpt,
        body: { markdown: cleanMarkdown(row.body_md), html: row.body_html },
        toc: row.toc,
        faq: row.faq,
        sources: row.sources,
        tags: row.tags,
        primaryTag: row.tags[0] ?? null,
        author,
        publisher,
        breadcrumbs,
        publishedAt,
        updatedAt,
        readingMinutes: row.reading_minutes,
        wordCount: row.word_count,
        openGraph: {
            title: row.title,
            description: row.excerpt,
            type: 'article' as const,
            url: row.url,
            locale: ogLocale,
            siteName: publisher.name,
            publishedTime: publishedAt,
            modifiedTime: updatedAt,
        },
        jsonLd: {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'Article',
                    headline: row.title,
                    description: row.meta_description,
                    datePublished: publishedAt,
                    dateModified: updatedAt,
                    inLanguage: row.locale,
                    mainEntityOfPage: row.url,
                    ...(author && { author: personOf(author) }),
                    publisher: organizationOf(publisher),
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: breadcrumbs.map((crumb, index) => ({
                        '@type': 'ListItem',
                        position: index + 1,
                        name: crumb.name,
                        item: crumb.url,
                    })),
                },
            ],
        },
    };
}

export function removalRecord(row: RedirectRow) {
    return {
        id: row.id,
        locale: row.locale,
        path: row.path,
        url: row.url,
        status: 'unpublished' as const,
        unpublishedAt: apiDate(row.unpublished_at),
        redirect: row.redirect_to
            ? { status: 301 as const, to: row.redirect_to }
            : null,
    };
}

export function sitemapItem(row: SitemapRow) {
    return {
        url: row.url,
        lastmod: apiDate(row.modified_at),
        alternates: alternatesOf(row.alternates),
    };
}

export function alternatesOf(versions: VersionRow['alternates']) {
    const main = versions.find((version) => version.is_default);

    return [
        ...versions.map((version) => ({
            hreflang: version.locale,
            url: version.url,
        })),
        ...(main ? [{ hreflang: 'x-default', url: main.url }] : []),
    ];
}

function hasPrefix(prefix: string | null) {
    return Boolean(prefix?.replace(/\//g, ''));
}

function personOf(author: {
    name: string;
    jobTitle: string | null;
    url: string | null;
    sameAs: string[];
}) {
    return {
        '@type': 'Person',
        name: author.name,
        ...(author.jobTitle && { jobTitle: author.jobTitle }),
        ...(author.url && { url: author.url }),
        ...(author.sameAs.length > 0 && { sameAs: author.sameAs }),
    };
}

function organizationOf(publisher: Publisher) {
    return {
        '@type': 'Organization',
        name: publisher.name,
        ...(publisher.url && { url: publisher.url }),
        ...(publisher.logo && {
            logo: { '@type': 'ImageObject', ...publisher.logo },
        }),
        ...(publisher.sameAs.length > 0 && { sameAs: publisher.sameAs }),
    };
}

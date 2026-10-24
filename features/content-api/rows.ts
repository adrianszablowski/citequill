import * as z from 'zod';

import { pageStatuses, faqItems, sourceItems } from '@/features/pages/schema';
import type { Database } from '@/lib/types/database';

type Functions = Database['public']['Functions'];

type Columns<Name extends keyof Functions> = {
    [Column in keyof RowOf<Functions[Name]['Returns']>]?: z.ZodType;
};

type RowOf<Returns> = Returns extends (infer Row)[] ? Row : never;

const alternates = z.array(
    z.object({ locale: z.string(), url: z.string(), is_default: z.boolean() }),
);

export const versionRow = z.object({
    id: z.string(),
    status: z.enum(pageStatuses),
    published_at: z.string(),
    unpublished_at: z.string().nullable(),
    redirect_to: z.string().nullable(),
    kind: z.string().nullable(),
    kind_url_prefix: z.string().nullable(),
    locale: z.string(),
    locale_base_url: z.string().nullable(),
    slug: z.string(),
    path: z.string(),
    url: z.string(),
    title: z.string(),
    meta_title: z.string(),
    meta_description: z.string(),
    excerpt: z.string(),
    body_md: z.string(),
    body_html: z.string(),
    toc: z
        .array(
            z.object({ id: z.string(), text: z.string(), level: z.number() }),
        )
        .catch([]),
    word_count: z.number(),
    reading_minutes: z.number(),
    faq: faqItems.catch([]),
    sources: sourceItems.catch([]),
    tags: z.array(z.string()),
    author_name: z.string().nullable(),
    author_title: z.string().nullable(),
    author_url: z.string().nullable(),
    author_same_as: z.array(z.string()).nullable(),
    modified_at: z.string(),
    updated_at: z.string(),
    alternates,
} satisfies Columns<'api_page'>);

export type VersionRow = z.infer<typeof versionRow>;

export const siteRow = z.object({
    project_name: z.string(),
    organization_name: z.string().nullable(),
    organization_url: z.string().nullable(),
    organization_logo_url: z.string().nullable(),
    organization_logo_width: z.number().nullable(),
    organization_logo_height: z.number().nullable(),
    organization_same_as: z.array(z.string()),
    locales: z.array(
        z.object({
            locale: z.string(),
            base_url: z.string(),
            is_default: z.boolean(),
        }),
    ),
} satisfies Columns<'api_site'>);

export type SiteRow = z.infer<typeof siteRow>;

export const redirectRow = z.object({
    id: z.string(),
    locale: z.string(),
    path: z.string(),
    url: z.string(),
    unpublished_at: z.string(),
    redirect_to: z.string().nullable(),
} satisfies Columns<'api_redirects'>);

export type RedirectRow = z.infer<typeof redirectRow>;

export const sitemapRow = z.object({
    id: z.string(),
    published_at: z.string(),
    url: z.string(),
    modified_at: z.string(),
    alternates,
} satisfies Columns<'api_sitemap'>);

export type SitemapRow = z.infer<typeof sitemapRow>;

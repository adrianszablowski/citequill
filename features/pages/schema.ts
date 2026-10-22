import * as z from 'zod';

import { slugify } from '@/features/pages/draft';
import { isWebUrl } from '@/lib/utils';

export const writePageSchema = z.object({
    topic: z
        .string()
        .trim()
        .min(5, 'Say what the page is about, in a few words at least.')
        .max(300, 'Keep the topic under 300 characters.'),
    kind_id: z.string().min(1, 'Pick a kind.'),
    locale: z.string().min(2, 'Pick a language.'),
});

export type WritePageValues = z.infer<typeof writePageSchema>;

export const pageSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'Give the page a title.')
        .max(120, 'Keep the title under 120 characters.'),
    slug: z
        .string()
        .trim()
        .min(1, 'Give the page a slug.')
        .max(80, 'Keep the slug under 80 characters.')
        .refine(
            (slug) => slugify(slug) === slug,
            'Use lowercase letters, digits and single hyphens, as in deload-week.',
        ),
    meta_title: z
        .string()
        .trim()
        .min(1, 'Give the page a meta title for search results.')
        .max(120, 'Keep the meta title under 120 characters.'),
    meta_description: z
        .string()
        .trim()
        .min(1, 'Give the page a meta description for search results.')
        .max(300, 'Keep the meta description under 300 characters.'),
    excerpt: z
        .string()
        .trim()
        .min(1, 'Give the page an excerpt for lists and link previews.')
        .max(300, 'Keep the excerpt under 300 characters.'),
    body_md: z.string().trim().min(1, 'The page needs a body.'),
    faq: z.array(
        z.object({
            question: z.string().trim().min(1, 'Write the question.'),
            answer: z.string().trim().min(1, 'Write the answer.'),
        }),
    ),
    sources: z.array(
        z.object({
            title: z.string().trim().min(1, 'Give the source a title.'),
            url: z
                .string()
                .trim()
                .refine(
                    isWebUrl,
                    'Give the full address, starting with https:// or http://.',
                ),
        }),
    ),
    tags: z.array(z.string().trim()).transform((tags) => tags.filter(Boolean)),
    author_id: z.string().nullable(),
});

export type PageValues = z.infer<typeof pageSchema>;

export const faqItems = z.array(
    z.object({ question: z.string(), answer: z.string() }),
);

export const sourceItems = z.array(
    z.object({ title: z.string(), url: z.string() }),
);

export function pageValues(
    page: Omit<PageValues, 'faq' | 'sources'> & {
        faq: unknown;
        sources: unknown;
    },
    kindAuthorId: string | null,
): PageValues {
    return {
        title: page.title,
        slug: page.slug,
        meta_title: page.meta_title,
        meta_description: page.meta_description,
        excerpt: page.excerpt,
        body_md: page.body_md,
        faq: faqItems.safeParse(page.faq).data ?? [],
        sources: sourceItems.safeParse(page.sources).data ?? [],
        tags: page.tags,
        author_id: page.author_id ?? kindAuthorId,
    };
}

export const pageStatuses = ['draft', 'published', 'unpublished'] as const;

export const pageSorts = [
    'title',
    'locale',
    'status',
    'published_at',
    'updated_at',
] as const;

export const pageSizes = [10, 50, 100] as const;

export type PageSize = (typeof pageSizes)[number];

const optionalText = z.string().trim().min(1).optional().catch(undefined);

export const pageListQuery = z.object({
    kind: optionalText,
    q: optionalText,
    locale: optionalText,
    status: z.enum(pageStatuses).optional().catch(undefined),
    from: z.iso.date().optional().catch(undefined),
    to: z.iso.date().optional().catch(undefined),
    sort: z.enum(pageSorts).catch('updated_at'),
    dir: z.enum(['asc', 'desc']).catch('desc'),
    page: z.coerce.number().int().min(1).catch(1),
    size: z.coerce.number().pipe(z.literal(pageSizes)).catch(10),
});

export type PageListQuery = z.infer<typeof pageListQuery>;

export const pageListDefaults = pageListQuery.parse({});

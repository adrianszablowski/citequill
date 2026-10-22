import 'server-only';

import { createHash } from 'node:crypto';

import * as z from 'zod';

import { readingMinutes } from '@/features/pages/draft';
import { renderMarkdown } from '@/features/pages/render';
import { publishCheck } from '@/features/publishing/check';
import { createAdminClient } from '@/lib/supabase/admin';
import { one } from '@/lib/supabase/result';

export async function publish(projectId: string, pageIds: string[]) {
    const supabase = createAdminClient();

    const [pages, locales] = await Promise.all([
        one(
            supabase
                .from('pages')
                .select(
                    'id, locale, slug, body_md, content_hash, author_id, page_kinds(url_prefix, author_id), published_pages(url)',
                )
                .eq('project_id', projectId)
                .in('id', pageIds),
        ),
        one(
            supabase
                .from('project_locales')
                .select('locale, base_url')
                .eq('project_id', projectId),
        ),
    ]);

    if (pages.length !== pageIds.length) {
        return { error: 'The page is gone from this project.' };
    }

    const versions = [];

    for (const page of pages) {
        const check = publishCheck(page, locales);

        if ('error' in check) {
            return { error: check.error };
        }

        const { html, toc, wordCount } = renderMarkdown(
            page.body_md,
            page.locale,
        );

        versions.push({
            page_id: page.id,
            content_hash: page.content_hash,
            path: check.address.path,
            url: check.address.url,
            body_html: html,
            toc,
            word_count: wordCount,
            body_hash: createHash('sha256').update(html).digest('hex'),
            reading_minutes: readingMinutes(wordCount),
        });
    }

    const { data, error } = await supabase.rpc('publish_pages', {
        project: projectId,
        versions,
    });

    if (error) {
        return {
            error:
                publishErrors[error.message] ??
                'Publishing did not finish. Try again.',
        };
    }

    return publishResult.parse(data);
}

export async function unpublish(
    projectId: string,
    pageId: string,
    redirect: string | null,
) {
    const { data, error } = await createAdminClient().rpc('unpublish_page', {
        project: projectId,
        page: pageId,
        redirect: redirect ?? undefined,
    });

    if (error) {
        return {
            error:
                error.message === notLive
                    ? 'The page is not live, so there is nothing to unpublish.'
                    : 'Unpublishing did not finish. Try again.',
        };
    }

    return unpublishResult.parse(data);
}

// The keys are the messages publish_pages and unpublish_page raise in
// supabase/migrations/, and change with them.
const publishErrors: Record<string, string> = {
    'The page changed since it was rendered.':
        'The page was saved while it was being published, so it did not go out. Publish it again.',
    "The page's path moved since it was published.":
        "The page's address changed while it was being published. Open the page again to see what moved.",
    'The page has no author.':
        "The page lost its author while it was being published. Pick the page's author in Edit, then publish it.",
};

const notLive = 'The page is not live in this project.';

const pageRecord = z.object({
    id: z.string(),
    locale: z.string(),
    slug: z.string(),
    path: z.string(),
    url: z.string(),
});

const publishResult = z.object({
    pages: z.array(
        pageRecord.extend({ was_live: z.boolean(), body_changed: z.boolean() }),
    ),
    updated: z.array(pageRecord),
});

const unpublishResult = z.object({
    pages: z.array(pageRecord.extend({ redirect: z.string().nullable() })),
    updated: z.array(pageRecord),
});

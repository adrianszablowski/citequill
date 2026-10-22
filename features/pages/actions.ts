'use server';

import { refresh } from 'next/cache';
import { start } from 'workflow/api';

import { getCurrentUser } from '@/features/auth/queries';
import { canonicalLocale } from '@/features/crawl/locales';
import {
    pageSchema,
    type PageValues,
    writePageSchema,
    type WritePageValues,
} from '@/features/pages/schema';
import { writePage } from '@/features/pages/workflow';
import { foreignAuthorError } from '@/features/projects/schema';
import { done, one } from '@/lib/supabase/result';
import { createClient } from '@/lib/supabase/server';

export async function startWrite(projectId: string, values: WritePageValues) {
    await getCurrentUser();

    const parsed = writePageSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the topic, the kind and the language.' };
    }

    const supabase = await createClient();

    const { data: kind } = await supabase
        .from('page_kinds')
        .select('id')
        .eq('id', parsed.data.kind_id)
        .eq('project_id', projectId)
        .maybeSingle();

    if (!kind) {
        return { error: 'Pick a kind of this project.' };
    }

    const { data, error } = await supabase
        .from('runs')
        .insert({
            project_id: projectId,
            trigger: 'manual',
            topic: parsed.data.topic,
            kind_id: parsed.data.kind_id,
            locale: canonicalLocale(parsed.data.locale),
        })
        .select('id')
        .single();

    if (error) {
        return { error: error.message };
    }

    try {
        await start(writePage, [projectId, data.id]);
    } catch (cause) {
        await supabase
            .from('runs')
            .update({
                status: 'failed',
                error: `The page could not start: ${cause instanceof Error ? cause.message : String(cause)}`,
                finished_at: new Date().toISOString(),
            })
            .eq('id', data.id);
    }

    return { runId: data.id };
}

export async function retryWrite(projectId: string, runId: string) {
    await getCurrentUser();

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('runs')
        .select('topic, kind_id, locale')
        .eq('id', runId)
        .eq('project_id', projectId)
        .single();

    if (error || !data.topic || !data.kind_id || !data.locale) {
        return { error: 'The run to try again is gone.' };
    }

    return startWrite(projectId, {
        topic: data.topic,
        kind_id: data.kind_id,
        locale: data.locale,
    });
}

export async function updatePage(id: string, values: PageValues) {
    await getCurrentUser();

    const parsed = pageSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the page.' };
    }

    const supabase = await createClient();

    if (
        parsed.data.author_id &&
        !(await isProjectAuthor(supabase, id, parsed.data.author_id))
    ) {
        return { error: foreignAuthorError };
    }

    const { error } = await supabase
        .from('pages')
        .update(parsed.data)
        .eq('id', id);

    if (error?.code === uniqueViolation) {
        return {
            error: 'Another page in this language has this slug. Pick another one.',
        };
    }

    if (error?.code === foreignKeyViolation) {
        return { error: foreignAuthorError };
    }

    if (error) {
        return { error: error.message };
    }

    return { values: parsed.data };
}

export async function discardChanges(projectId: string, pageId: string) {
    await getCurrentUser();

    const supabase = await createClient();

    const { data: live, error } = await supabase
        .from('published_pages')
        .select(
            'title, meta_title, meta_description, excerpt, body_md, faq, sources, tags, author_id',
        )
        .eq('project_id', projectId)
        .eq('page_id', pageId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!live) {
        return { error: 'The page has no live version to go back to.' };
    }

    await done(
        supabase
            .from('pages')
            .update(live)
            .eq('project_id', projectId)
            .eq('id', pageId),
    );

    refresh();

    return { values: live };
}

async function isProjectAuthor(
    supabase: Awaited<ReturnType<typeof createClient>>,
    pageId: string,
    authorId: string,
) {
    const page = await one(
        supabase.from('pages').select('project_id').eq('id', pageId).single(),
    );

    const { data, error } = await supabase
        .from('authors')
        .select('id')
        .eq('id', authorId)
        .eq('project_id', page.project_id)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data !== null;
}

const uniqueViolation = '23505';

const foreignKeyViolation = '23503';

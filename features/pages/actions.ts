'use server';

import { start } from 'workflow/api';

import { getCurrentUser } from '@/features/auth/queries';
import {
    pageSchema,
    type PageValues,
    writePageSchema,
    type WritePageValues,
} from '@/features/pages/schema';
import { writePage } from '@/features/pages/workflow';
import { readingMinutes } from '@/features/pages/draft';
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
            locale: parsed.data.locale,
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

    const { error } = await supabase
        .from('pages')
        .update({
            ...parsed.data,
            reading_minutes: readingMinutes(parsed.data.body_md),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id);

    if (error) {
        return { error: error.message };
    }

    return { values: parsed.data };
}

import 'server-only';

import { cache } from 'react';

import { isStaleRun } from '@/features/runs/stale';
import { createClient } from '@/lib/supabase/server';

export const getPageList = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('pages')
        .select(
            'id, title, status, locale, check_note, updated_at, page_kinds(name)',
        )
        .eq('project_id', projectId)
        .order('updated_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data;
});

export type PageListItem = Awaited<ReturnType<typeof getPageList>>[number];

export const getPage = cache(async (projectId: string, pageId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('pages')
        .select(
            'id, title, slug, status, locale, meta_title, meta_description, excerpt, body_md, faq, sources, tags, reading_minutes, check_note, updated_at, page_kinds(name, url_prefix)',
        )
        .eq('project_id', projectId)
        .eq('id', pageId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
});

export type Page = NonNullable<Awaited<ReturnType<typeof getPage>>>;

export const getWriteRuns = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('runs')
        .select(
            'id, topic, locale, kind_id, status, error, started_at, page_kinds(name), pages(id)',
        )
        .eq('project_id', projectId)
        .eq('trigger', 'manual')
        .order('started_at', { ascending: false })
        .limit(recentRuns);

    if (error) {
        throw error;
    }

    return data.flatMap((run) => {
        const outcome = outcomeOf(run);

        return outcome ? [{ ...run, outcome }] : [];
    });
});

export type WriteRun = Awaited<ReturnType<typeof getWriteRuns>>[number];

function outcomeOf(run: {
    status: string;
    started_at: string;
    pages: { id: string }[];
}) {
    const isStale = isStaleRun(run);

    if (run.status === 'running' && !isStale) {
        return 'writing' as const;
    }

    if ((run.status === 'failed' || isStale) && run.pages.length === 0) {
        return 'failed' as const;
    }

    return null;
}

const recentRuns = 20;

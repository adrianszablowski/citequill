import 'server-only';

import { cache } from 'react';

import { titlePattern } from '@/features/pages/list-query';
import type { PageListQuery } from '@/features/pages/schema';
import { isStaleRun } from '@/features/runs/stale';
import { createClient } from '@/lib/supabase/server';

export async function getPageList(projectId: string, query: PageListQuery) {
    const supabase = await createClient();
    const first = (query.page - 1) * query.size;

    let request = supabase
        .from('pages')
        .select(
            'id, title, status, locale, check_note, published_at, updated_at',
            { count: 'exact' },
        )
        .eq('project_id', projectId)
        .order(query.sort, {
            ascending: query.dir === 'asc',
            nullsFirst: false,
        })
        .order('id')
        .range(first, first + query.size - 1);

    if (query.kind) {
        request = request.eq('kind_id', query.kind);
    }

    if (query.q) {
        request = request.ilike('title', titlePattern(query.q));
    }

    if (query.locale) {
        request = request.eq('locale', query.locale);
    }

    if (query.status) {
        request = request.eq('status', query.status);
    }

    if (query.from) {
        request = request.gte('published_at', query.from);
    }

    if (query.to) {
        request = request.lte('published_at', `${query.to}T23:59:59.999Z`);
    }

    const { data, error, count } = await request;

    // PostgREST answers a range that starts past the last row with 416 and no
    // count, so a page beyond the end is a result, not a failure.
    if (error?.code === 'PGRST103') {
        return { pages: [], total: null };
    }

    if (error) {
        throw error;
    }

    return { pages: data, total: count ?? 0 };
}

export type PageListItem = Awaited<
    ReturnType<typeof getPageList>
>['pages'][number];

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
            'id, topic, locale, kind_id, status, error, started_at, progressed_at, page_kinds(name), pages(id)',
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
    progressed_at: string | null;
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

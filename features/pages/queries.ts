import 'server-only';

import { cache } from 'react';

import { titlePattern } from '@/features/pages/list-query';
import type { PageListQuery } from '@/features/pages/schema';
import { isStaleRun } from '@/features/runs/stale';
import { paged } from '@/lib/supabase/result';
import { createClient } from '@/lib/supabase/server';

export async function getPageList(projectId: string, query: PageListQuery) {
    const supabase = await createClient();
    const first = (query.page - 1) * query.size;

    let request = supabase
        .from('pages')
        .select(
            'id, title, status, locale, check_note, content_hash, translation_group_id, published_at, updated_at, published_pages(content_hash, modified_at)',
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

    return paged(await request);
}

export type PageListItem = Awaited<
    ReturnType<typeof getPageList>
>['rows'][number];

export const getPage = cache(async (projectId: string, pageId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('pages')
        .select(
            'id, title, slug, status, locale, meta_title, meta_description, excerpt, body_md, faq, sources, tags, author_id, check_note, content_hash, translation_group_id, published_at, updated_at, page_kinds(name, url_prefix, author_id), published_pages(path, url, content_hash, modified_at)',
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

export async function getPageVersions(projectId: string, groupIds: string[]) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('pages')
        .select(
            'id, locale, status, content_hash, translation_group_id, published_pages(content_hash, modified_at)',
        )
        .eq('project_id', projectId)
        .in('translation_group_id', groupIds)
        .order('locale');

    if (error) {
        throw error;
    }

    return data;
}

export type PageVersion = Awaited<ReturnType<typeof getPageVersions>>[number];

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

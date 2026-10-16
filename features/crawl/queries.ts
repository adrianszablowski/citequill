import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export const getLatestCrawl = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('runs')
        .select('id, status, error, started_at')
        .eq('project_id', projectId)
        .eq('trigger', 'crawl')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return null;
    }

    const isStale =
        data.status === 'running' &&
        Date.now() - new Date(data.started_at).getTime() > staleAfterMs;

    return { ...data, isStale };
});

export const getCrawledPageCount = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { count, error } = await supabase
        .from('crawled_pages')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);

    if (error) {
        throw error;
    }

    return count ?? 0;
});

const staleAfterMs = 15 * 60 * 1000;

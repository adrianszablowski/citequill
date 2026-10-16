'use server';

import { redirect } from 'next/navigation';
import { start } from 'workflow/api';

import { getCurrentUser } from '@/features/auth/queries';
import { getLatestCrawl } from '@/features/crawl/queries';
import { crawlSite } from '@/features/crawl/workflow';
import { createClient } from '@/lib/supabase/server';

export async function startCrawl(projectId: string) {
    await getCurrentUser();

    const latest = await getLatestCrawl(projectId);

    if (latest?.status === 'running' && !latest.isStale) {
        redirect(`/connect/${projectId}`);
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('runs')
        .insert({ project_id: projectId, trigger: 'crawl' })
        .select('id')
        .single();

    if (error) {
        return { error: error.message };
    }

    try {
        await start(crawlSite, [projectId, data.id]);
    } catch (cause) {
        await supabase
            .from('runs')
            .update({
                status: 'failed',
                error: `The crawl could not start: ${cause instanceof Error ? cause.message : String(cause)}`,
                finished_at: new Date().toISOString(),
            })
            .eq('id', data.id);
    }

    redirect(`/connect/${projectId}`);
}

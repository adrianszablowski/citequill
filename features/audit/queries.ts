import 'server-only';

import { cache } from 'react';

import { startedAgo } from '@/features/audit/format';
import { isStaleRun } from '@/features/runs/stale';
import { createClient } from '@/lib/supabase/server';

export const getAudits = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('runs')
        .select(
            'id, status, error, started_at, progressed_at, workflow_run_id, audits(id, created_at, pages_read, pages_indexable, duration_s, is_partial, score, is_gated, checks_scored, checks_total)',
        )
        .eq('project_id', projectId)
        .eq('trigger', 'audit')
        .order('started_at', { ascending: false });

    if (error) {
        throw error;
    }

    const now = Date.now();

    return data.map(({ audits: audit, ...run }) => ({
        run,
        audit,
        status: isStaleRun(run, now) ? ('stalled' as const) : run.status,
        started: startedAgo(run.started_at, now),
    }));
});

export type Audit = Awaited<ReturnType<typeof getAudits>>[number];

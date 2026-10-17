'use server';

import { redirect } from 'next/navigation';
import { getRun, start } from 'workflow/api';

import { stalledMessage } from '@/features/audit/format';
import { type Audit, getAudits } from '@/features/audit/queries';
import { auditSite } from '@/features/audit/workflow';
import { writeScore } from '@/features/audit/write-score';
import { getCurrentUser } from '@/features/auth/queries';
import { sectionHref } from '@/lib/sections';
import { createClient } from '@/lib/supabase/server';

export async function startAudit(projectId: string) {
    await getCurrentUser();

    const [latest] = await getAudits(projectId);

    if (latest?.status === 'running') {
        redirect(sectionHref(projectId, 'audit'));
    }

    const supabase = await createClient();

    if (latest?.status === 'stalled') {
        await endRun(supabase, latest.run, stalledMessage);
    }

    const { data: run, error } = await supabase
        .from('runs')
        .insert({ project_id: projectId, trigger: 'audit' })
        .select('id')
        .single();

    if (error) {
        return { error: error.message };
    }

    try {
        const { data: auditId, error: auditError } = await supabase.rpc(
            'create_audit',
            { run: run.id },
        );

        if (auditError || !auditId) {
            throw new Error(auditError?.message ?? 'the audit has no row');
        }

        const workflow = await start(auditSite, [projectId, run.id, auditId]);

        await supabase
            .from('runs')
            .update({ workflow_run_id: workflow.runId })
            .eq('id', run.id);
    } catch (cause) {
        await supabase
            .from('runs')
            .update({
                status: 'failed',
                error: `The audit could not start: ${cause instanceof Error ? cause.message : String(cause)}`,
                finished_at: new Date().toISOString(),
            })
            .eq('id', run.id);
    }

    redirect(sectionHref(projectId, 'audit'));
}

export async function stopAudit(projectId: string) {
    await getCurrentUser();

    const [latest] = await getAudits(projectId);

    if (latest?.run.status !== 'running') {
        redirect(sectionHref(projectId, 'audit'));
    }

    const supabase = await createClient();

    const hasEnded = await endRun(
        supabase,
        latest.run,
        'You stopped the audit.',
    );

    if (hasEnded && latest.audit) {
        await supabase.rpc('stop_audit', { audit: latest.audit.id });

        // The run has ended either way; a score that fails to write leaves the
        // stopped audit unscored and the owner still lands on the section.
        await writeScore(supabase, {
            projectId,
            auditId: latest.audit.id,
            hasCrossPageChecks: false,
        }).catch(() => undefined);
    }

    redirect(sectionHref(projectId, 'audit'));
}

async function endRun(
    supabase: Awaited<ReturnType<typeof createClient>>,
    run: Audit['run'],
    message: string,
) {
    if (run.workflow_run_id) {
        // A Workflow run that has already ended refuses to be cancelled; the
        // run row below ends either way.
        await getRun(run.workflow_run_id)
            .cancel()
            .catch(() => undefined);
    }

    const { data } = await supabase
        .from('runs')
        .update({
            status: 'failed',
            error: message,
            finished_at: new Date().toISOString(),
        })
        .eq('id', run.id)
        .eq('status', 'running')
        .select('id');

    return (data ?? []).length > 0;
}

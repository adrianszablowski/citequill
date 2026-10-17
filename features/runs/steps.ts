import type { ModelId } from '@/lib/anthropic';
import { costUsd, type Usage } from '@/lib/pricing';
import { createAdminClient } from '@/lib/supabase/admin';

export async function finishRun(runId: string) {
    'use step';

    const { error } = await createAdminClient()
        .from('runs')
        .update({
            status: 'finished',
            finished_at: new Date().toISOString(),
        })
        .eq('id', runId)
        .eq('status', 'running');

    if (error) {
        throw new Error(error.message);
    }
}

export async function failRun(runId: string, message: string) {
    'use step';

    await createAdminClient()
        .from('runs')
        .update({
            status: 'failed',
            error: message,
            finished_at: new Date().toISOString(),
        })
        .eq('id', runId)
        .eq('status', 'running');
}

export async function markProgress(runId: string) {
    const { error } = await createAdminClient()
        .from('runs')
        .update({ progressed_at: new Date().toISOString() })
        .eq('id', runId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function addUsage(runId: string, model: ModelId, usage: Usage) {
    const { error } = await createAdminClient().rpc('add_run_usage', {
        run: runId,
        input: usage.input_tokens,
        output: usage.output_tokens,
        cost: costUsd(model, usage),
    });

    if (error) {
        throw new Error(error.message);
    }
}

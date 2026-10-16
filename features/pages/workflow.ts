import {
    checkDraft,
    correctDraft,
    loadWriteContext,
    saveDraft,
    writeBrief,
    writeDraft,
} from '@/features/pages/steps';
import { failRun, finishRun } from '@/features/runs/steps';

export async function writePage(projectId: string, runId: string) {
    'use workflow';

    try {
        const target = await loadWriteContext(projectId, runId);
        const brief = await writeBrief(runId, target.context);

        let page = await writeDraft(runId, target.context, brief);
        let findings = await checkDraft(runId, target.context, page);

        if (findings.length > 0) {
            page = await correctDraft(
                runId,
                target.context,
                brief,
                page,
                findings,
            );

            findings = await checkDraft(runId, target.context, page);
        }

        await saveDraft(projectId, runId, target, page, findings);
        await finishRun(runId);
    } catch (error) {
        await failRun(
            runId,
            error instanceof Error ? error.message : String(error),
        );
    }
}

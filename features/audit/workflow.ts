import {
    closeAudit,
    discoverSite,
    readPages,
    type Reading,
} from '@/features/audit/steps';
import { failRun } from '@/features/runs/steps';

export async function auditSite(
    projectId: string,
    runId: string,
    auditId: string,
) {
    'use workflow';

    try {
        let reading: Reading = {
            hasWork: true,
            pace: await discoverSite(projectId, runId, auditId),
        };

        while (reading.hasWork) {
            reading = await readPages(projectId, runId, auditId, reading.pace);
        }

        await closeAudit(projectId, runId, auditId);
    } catch (error) {
        await failRun(
            runId,
            error instanceof Error ? error.message : String(error),
        );
    }
}

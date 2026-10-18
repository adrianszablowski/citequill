import {
    checkResources,
    checkSite,
    closeAudit,
    discoverSite,
    probeSite,
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

        let checking: Reading = { hasWork: true, pace: reading.pace };

        while (checking.hasWork) {
            checking = await checkResources(
                projectId,
                runId,
                auditId,
                checking.pace,
            );
        }

        await probeSite(projectId, runId, auditId, checking.pace);
        await checkSite(projectId, runId, auditId);
        await closeAudit(projectId, runId, auditId);
    } catch (error) {
        await failRun(
            runId,
            error instanceof Error ? error.message : String(error),
        );
    }
}

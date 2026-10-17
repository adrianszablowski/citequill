import type { Audit } from '@/features/audit/queries';

export function shownAudit(audits: Audit[]) {
    const shown = audits.find(
        ({ run, audit }) => audit !== null && run.status !== 'running',
    );

    if (!shown?.audit) {
        return null;
    }

    return {
        audit: shown.audit,
        isFinished: shown.run.status === 'finished',
        isLatest: audits
            .slice(0, audits.indexOf(shown))
            .every((entry) => entry.audit === null),
    };
}

export function comparedAudits(audits: Audit[]) {
    const [latest, ...older] = audits;

    if (latest?.status !== 'finished' || !latest.audit) {
        return null;
    }

    const previous = older.find(
        ({ run, audit }) => audit !== null && run.status !== 'running',
    )?.audit;

    if (
        !previous ||
        latest.audit.score === null ||
        previous.score === null ||
        previous.checks_scored !== latest.audit.checks_scored
    ) {
        return null;
    }

    return {
        latestId: latest.audit.id,
        previousId: previous.id,
        since: previous.created_at,
        difference: latest.audit.score - previous.score,
    };
}

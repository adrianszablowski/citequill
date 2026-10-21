import { previousAudit } from '@/features/audit/changes';
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

    const {
        score_difference: difference,
        findings_fixed: fixed,
        findings_new: added,
    } = latest.audit;

    const previous = previousAudit(older);

    if (!previous || difference === null || fixed === null || added === null) {
        return null;
    }

    return { since: previous.created_at, difference, fixed, added };
}

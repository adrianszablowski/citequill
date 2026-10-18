export interface Fingerprinted {
    fingerprint: string;
}

export function auditChanges(
    previous: Fingerprinted[],
    latest: Fingerprinted[],
) {
    const before = new Set(previous.map((finding) => finding.fingerprint));
    const after = new Set(latest.map((finding) => finding.fingerprint));

    return {
        fixed: previous.filter((finding) => !after.has(finding.fingerprint))
            .length,
        added: latest.filter((finding) => !before.has(finding.fingerprint))
            .length,
    };
}

export interface ScoredAudit {
    id: string;
    created_at: string;
    score: number | null;
    checks_scored: number;
}

export interface AuditEntry {
    run: { status: string };
    audit: ScoredAudit | null;
}

export function comparedPair(
    latest: Pick<ScoredAudit, 'score' | 'checks_scored'>,
    older: AuditEntry[],
) {
    const previous = older.find(
        ({ run, audit }) => audit !== null && run.status !== 'running',
    )?.audit;

    if (
        !previous ||
        latest.score === null ||
        previous.score === null ||
        previous.checks_scored !== latest.checks_scored
    ) {
        return null;
    }

    return {
        previousId: previous.id,
        since: previous.created_at,
        difference: latest.score - previous.score,
    };
}

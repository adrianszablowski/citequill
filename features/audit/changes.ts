import { auditScore, type CheckResult, gateCap } from '@/features/audit/score';

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

interface AuditEntry<Row> {
    run: { status: string };
    audit: Row | null;
}

export function previousAudit<Row>(older: AuditEntry<Row>[]) {
    return (
        older.find(
            ({ run, audit }) => audit !== null && run.status === 'finished',
        )?.audit ?? null
    );
}

export interface ComparedAudit {
    checksRun: readonly string[];
    isGated: boolean;
    results: CheckResult[];
    findings: (Fingerprinted & { check: string })[];
}

export function auditComparison(
    previous: ComparedAudit,
    latest: ComparedAudit,
) {
    const common = new Set(
        latest.checksRun.filter((check) => previous.checksRun.includes(check)),
    );

    const scoreOf = ({ isGated, results }: ComparedAudit) => {
        const score = auditScore(
            results.filter((result) => common.has(result.check)),
        );

        return isGated ? Math.min(score, gateCap) : score;
    };

    const findingsOf = ({ findings }: ComparedAudit) =>
        findings.filter((finding) => common.has(finding.check));

    return {
        difference: scoreOf(latest) - scoreOf(previous),
        ...auditChanges(findingsOf(previous), findingsOf(latest)),
    };
}

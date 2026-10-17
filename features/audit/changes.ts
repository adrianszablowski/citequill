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

import { describe, expect, it } from 'vitest';

import {
    auditChanges,
    auditComparison,
    type ComparedAudit,
    previousAudit,
} from '@/features/audit/changes';

function findings(...fingerprints: string[]) {
    return fingerprints.map((fingerprint) => ({ fingerprint }));
}

describe('auditChanges', () => {
    it('counts a finding of the previous audit that the latest lacks as fixed', () => {
        expect(auditChanges(findings('a', 'b'), findings('a'))).toEqual({
            fixed: 1,
            added: 0,
        });
    });

    it('counts a finding of the latest audit that the previous lacks as new', () => {
        expect(auditChanges(findings('a'), findings('a', 'c', 'd'))).toEqual({
            fixed: 0,
            added: 2,
        });
    });

    it('counts a finding marked intended between the audits as neither, because its fingerprint is in both', () => {
        const latest = [{ fingerprint: 'a', is_intended: true }];

        expect(auditChanges(findings('a'), latest)).toEqual({
            fixed: 0,
            added: 0,
        });
    });

    it('finds nothing changed between two audits with no findings', () => {
        expect(auditChanges([], [])).toEqual({ fixed: 0, added: 0 });
    });
});

describe('previousAudit', () => {
    const entry = (status: string, id: string | null) => ({
        run: { status },
        audit: id === null ? null : { id, is_partial: id === 'partial' },
    });

    it('takes the last earlier audit whose run finished, a partial one included', () => {
        expect(
            previousAudit([
                entry('finished', 'partial'),
                entry('finished', 'a'),
            ]),
        ).toEqual({ id: 'partial', is_partial: true });
    });

    it('passes over a run still running, a stopped or failed one and one that never got its audit row', () => {
        expect(
            previousAudit([
                entry('running', 'running'),
                entry('failed', 'stopped'),
                entry('finished', null),
                entry('finished', 'a'),
            ]),
        ).toEqual({ id: 'a', is_partial: false });
    });

    it('finds none for the first audit of a project or when no earlier run finished', () => {
        expect(previousAudit([])).toBeNull();

        expect(
            previousAudit([entry('running', 'b'), entry('failed', 'a')]),
        ).toBeNull();
    });
});

function audit(compared: Partial<ComparedAudit> = {}): ComparedAudit {
    return {
        checksRun: ['title-missing', 'page-4xx'],
        isGated: false,
        results: [],
        findings: [],
        ...compared,
    };
}

const titleMissing = {
    check: 'title-missing',
    pages_checked: 2,
    pages_failed: 1,
    pages_intended: 0,
};

describe('auditComparison', () => {
    it('adds the penalty of a check that ran in both audits and has results in the latest only to the latest', () => {
        expect(
            auditComparison(
                audit(),
                audit({
                    results: [titleMissing],
                    findings: [{ fingerprint: 'a', check: 'title-missing' }],
                }),
            ),
        ).toEqual({ difference: -5, fixed: 0, added: 1 });
    });

    it('leaves a check that ran in one audit only out of the difference and both counts, as a CDN test that passed once', () => {
        const withCdnTest = audit({
            checksRun: ['title-missing', 'ai-cdn-blocked'],
            results: [
                {
                    check: 'ai-cdn-blocked',
                    pages_checked: 1,
                    pages_failed: 1,
                    pages_intended: 0,
                },
            ],
            findings: [{ fingerprint: 'cdn', check: 'ai-cdn-blocked' }],
        });

        const without = audit({ checksRun: ['title-missing'] });

        expect(auditComparison(withCdnTest, without)).toEqual({
            difference: 0,
            fixed: 0,
            added: 0,
        });

        expect(auditComparison(without, withCdnTest)).toEqual({
            difference: 0,
            fixed: 0,
            added: 0,
        });
    });

    it('caps the score of each audit that was gated, and only that one', () => {
        expect(auditComparison(audit({ isGated: true }), audit())).toEqual({
            difference: 51,
            fixed: 0,
            added: 0,
        });

        expect(
            auditComparison(
                audit(),
                audit({ isGated: true, results: [titleMissing] }),
            ),
        ).toMatchObject({ difference: -51 });
    });

    it('gives a difference of 0 for the same results, and counts the findings fixed and new by fingerprint', () => {
        expect(
            auditComparison(
                audit({
                    results: [titleMissing],
                    findings: [
                        { fingerprint: 'kept', check: 'title-missing' },
                        { fingerprint: 'fixed', check: 'page-4xx' },
                    ],
                }),
                audit({
                    results: [titleMissing],
                    findings: [
                        { fingerprint: 'kept', check: 'title-missing' },
                        { fingerprint: 'new', check: 'title-missing' },
                    ],
                }),
            ),
        ).toEqual({ difference: 0, fixed: 1, added: 1 });
    });
});

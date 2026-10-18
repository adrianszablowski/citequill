import { describe, expect, it } from 'vitest';

import {
    type AuditEntry,
    auditChanges,
    comparedPair,
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

function older(
    status: string,
    audit: Partial<NonNullable<AuditEntry['audit']>> | null = {},
): AuditEntry {
    return {
        run: { status },
        audit: audit && {
            id: 'previous',
            created_at: '2026-10-03T10:00:00Z',
            score: 80,
            checks_scored: 40,
            ...audit,
        },
    };
}

describe('comparedPair', () => {
    const latest = { score: 87, checks_scored: 40 };

    it('compares with the last earlier audit that ended when both stand on the same checks', () => {
        expect(comparedPair(latest, [older('finished')])).toEqual({
            previousId: 'previous',
            since: '2026-10-03T10:00:00Z',
            difference: 7,
        });
    });

    it('passes over an earlier run still running and one that never got its audit row', () => {
        expect(
            comparedPair(latest, [
                older('running', { id: 'running' }),
                older('failed', null),
                older('failed', { id: 'stopped', score: 90 }),
            ]),
        ).toMatchObject({ previousId: 'stopped', difference: -3 });
    });

    it('compares nothing when the check counts differ', () => {
        expect(
            comparedPair(latest, [older('finished', { checks_scored: 41 })]),
        ).toBeNull();
    });

    it('compares nothing when either audit has no score', () => {
        expect(
            comparedPair({ ...latest, score: null }, [older('finished')]),
        ).toBeNull();

        expect(
            comparedPair(latest, [older('finished', { score: null })]),
        ).toBeNull();
    });

    it('compares nothing for the first audit of a project', () => {
        expect(comparedPair(latest, [])).toBeNull();
        expect(comparedPair(latest, [older('running')])).toBeNull();
    });
});

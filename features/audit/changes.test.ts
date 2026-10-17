import { describe, expect, it } from 'vitest';

import { auditChanges } from '@/features/audit/changes';

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

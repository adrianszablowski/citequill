import { describe, expect, it } from 'vitest';

import type { Audit } from '@/features/audit/queries';
import { comparedAudits, shownAudit } from '@/features/audit/shown';

function entry(
    status: Audit['status'],
    audit: Partial<NonNullable<Audit['audit']>> | null = {},
): Audit {
    return {
        run: {
            id: `run-${audit?.id ?? 'none'}`,
            status: status === 'stalled' ? 'running' : status,
            error: null,
            started_at: '2026-10-17T10:00:00Z',
            progressed_at: null,
            workflow_run_id: null,
            cost_usd: 0,
        },
        audit: audit && {
            id: 'audit',
            created_at: '2026-10-17T10:00:00Z',
            pages_read: 10,
            pages_indexable: 10,
            duration_s: 60,
            is_partial: false,
            score: 80,
            is_gated: false,
            checks_scored: 40,
            checks_total: 116,
            ...audit,
        },
        status,
        started: '',
    };
}

describe('shownAudit', () => {
    it('shows the latest audit once its run has ended, and lets the owner mark it', () => {
        expect(shownAudit([entry('finished', { id: 'a' })])).toMatchObject({
            audit: { id: 'a' },
            isFinished: true,
            isLatest: true,
        });
    });

    it('shows the previous audit while one runs, and lets nobody mark it', () => {
        const shown = shownAudit([
            entry('running', { id: 'b' }),
            entry('finished', { id: 'a' }),
        ]);

        expect(shown).toMatchObject({ audit: { id: 'a' }, isLatest: false });
    });

    it('shows the partial findings of a stopped audit', () => {
        expect(shownAudit([entry('failed', { id: 'a' })])).toMatchObject({
            audit: { id: 'a' },
            isFinished: false,
            isLatest: true,
        });
    });

    it('shows nothing when no audit has ended', () => {
        expect(shownAudit([entry('stalled', { id: 'a' })])).toBeNull();
        expect(shownAudit([])).toBeNull();
    });

    it('passes over a run that never got its audit row', () => {
        expect(
            shownAudit([entry('failed', null), entry('finished', { id: 'a' })]),
        ).toMatchObject({ audit: { id: 'a' }, isLatest: true });
    });
});

describe('comparedAudits', () => {
    it('compares the latest audit with the one before when both stand on the same checks', () => {
        expect(
            comparedAudits([
                entry('finished', { id: 'b', score: 87 }),
                entry('finished', {
                    id: 'a',
                    score: 80,
                    created_at: '2026-10-03T10:00:00Z',
                }),
            ]),
        ).toEqual({
            latestId: 'b',
            previousId: 'a',
            since: '2026-10-03T10:00:00Z',
            difference: 7,
        });
    });

    it('compares nothing when the check counts differ', () => {
        expect(
            comparedAudits([
                entry('finished', { id: 'b', checks_scored: 41 }),
                entry('finished', { id: 'a', checks_scored: 40 }),
            ]),
        ).toBeNull();
    });

    it('compares nothing for a single audit, a running one or one with no score', () => {
        expect(comparedAudits([entry('finished')])).toBeNull();

        expect(
            comparedAudits([entry('running'), entry('finished')]),
        ).toBeNull();

        expect(
            comparedAudits([
                entry('finished'),
                entry('finished', { score: null }),
            ]),
        ).toBeNull();
    });
});

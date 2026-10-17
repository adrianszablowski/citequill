import { describe, expect, it } from 'vitest';

import { isStaleRun, staleAfterMs } from '@/features/runs/stale';

describe('isStaleRun', () => {
    const startedAt = new Date('2026-10-16T10:00:00Z');

    const run = {
        status: 'running',
        started_at: startedAt.toISOString(),
        progressed_at: null,
    };

    it('counts a run with no progress as stopped fifteen minutes after it started', () => {
        expect(isStaleRun(run, startedAt.getTime() + staleAfterMs + 1)).toBe(
            true,
        );

        expect(isStaleRun(run, startedAt.getTime() + staleAfterMs)).toBe(false);
    });

    it('measures from the last progress a step wrote', () => {
        const progressedAt = startedAt.getTime() + staleAfterMs * 3;

        const progressed = {
            ...run,
            progressed_at: new Date(progressedAt).toISOString(),
        };

        expect(isStaleRun(progressed, progressedAt + staleAfterMs)).toBe(false);

        expect(isStaleRun(progressed, progressedAt + staleAfterMs + 1)).toBe(
            true,
        );
    });

    it('never counts a finished or failed run as stale', () => {
        const later = startedAt.getTime() + staleAfterMs * 2;

        expect(isStaleRun({ ...run, status: 'finished' }, later)).toBe(false);
        expect(isStaleRun({ ...run, status: 'failed' }, later)).toBe(false);
    });
});

import { describe, expect, it } from 'vitest';

import { isStaleRun, staleAfterMs } from '@/features/runs/stale';

describe('isStaleRun', () => {
    const startedAt = new Date('2026-10-16T10:00:00Z');
    const run = { status: 'running', started_at: startedAt.toISOString() };

    it('counts a run as stopped after fifteen minutes', () => {
        expect(isStaleRun(run, startedAt.getTime() + staleAfterMs + 1)).toBe(
            true,
        );

        expect(isStaleRun(run, startedAt.getTime() + staleAfterMs)).toBe(false);
    });

    it('never counts a finished or failed run as stale', () => {
        const later = startedAt.getTime() + staleAfterMs * 2;

        expect(isStaleRun({ ...run, status: 'finished' }, later)).toBe(false);
        expect(isStaleRun({ ...run, status: 'failed' }, later)).toBe(false);
    });
});

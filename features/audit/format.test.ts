import { describe, expect, it } from 'vitest';

import { formatDuration, startedAgo } from '@/features/audit/format';

describe('formatDuration', () => {
    it('reads in seconds, minutes, or hours and minutes', () => {
        expect(formatDuration(42)).toBe('42 s');
        expect(formatDuration(750)).toBe('13 min');
        expect(formatDuration(3_600 * 2 + 60 * 5)).toBe('2 h 5 min');
    });
});

describe('startedAgo', () => {
    it('counts whole minutes since the start', () => {
        const start = '2026-10-17T10:00:00Z';
        const at = (minutes: number) => Date.parse(start) + minutes * 60_000;

        expect(startedAgo(start, at(0.5))).toBe(
            'Started less than a minute ago.',
        );

        expect(startedAgo(start, at(1))).toBe('Started a minute ago.');
        expect(startedAgo(start, at(12.9))).toBe('Started 12 minutes ago.');
    });
});

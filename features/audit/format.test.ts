import { describe, expect, it } from 'vitest';

import {
    changesLine,
    formatDuration,
    startedAgo,
} from '@/features/audit/format';

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

describe('changesLine', () => {
    it('says the score difference, the date of the previous audit, and the findings fixed and new', () => {
        expect(
            changesLine({
                difference: 7,
                since: '2026-10-03T10:00:00Z',
                fixed: 12,
                added: 2,
            }),
        ).toBe('+7 since 3 Oct 2026, 12 findings fixed, 2 new');
    });

    it('writes a fall with its minus sign and one finding in the singular', () => {
        expect(
            changesLine({
                difference: -3,
                since: '2026-10-03T10:00:00Z',
                fixed: 1,
                added: 0,
            }),
        ).toBe('-3 since 3 Oct 2026, 1 finding fixed, 0 new');
    });

    it('says no change when the score is the same', () => {
        expect(
            changesLine({
                difference: 0,
                since: '2026-10-03T10:00:00Z',
                fixed: 0,
                added: 0,
            }),
        ).toBe('No change since 3 Oct 2026, 0 findings fixed, 0 new');
    });
});

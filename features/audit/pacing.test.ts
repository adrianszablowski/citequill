import { describe, expect, it } from 'vitest';

import {
    afterAnswer,
    firstPace,
    hasStopped,
    maxPauseMs,
    type Pace,
    requestIntervalMs,
    streakLimit,
    takeSlot,
} from '@/features/audit/pacing';

const interval = requestIntervalMs;

describe('takeSlot', () => {
    it('spaces the start of each request by the interval', () => {
        const first = takeSlot(firstPace, interval, 1_000);
        const second = takeSlot(first.pace, interval, 1_050);
        const late = takeSlot(second.pace, interval, 5_000);

        expect([first.at, second.at, late.at]).toEqual([1_000, 1_200, 5_000]);
    });
});

describe('afterAnswer', () => {
    it('waits for Retry-After on a 429 or a 503, up to a minute', () => {
        const now = 10_000;

        expect(afterAnswer(firstPace, 429, '7', interval, now).nextAt).toBe(
            now + 7_000,
        );

        expect(
            afterAnswer(
                firstPace,
                503,
                new Date(now + 3_000).toUTCString(),
                interval,
                now,
            ).nextAt,
        ).toBeGreaterThanOrEqual(now + 2_000);

        expect(afterAnswer(firstPace, 429, '3600', interval, now).nextAt).toBe(
            now + maxPauseMs,
        );
    });

    it('doubles its pause without Retry-After, up to a minute, and drops it after an answer', () => {
        let pace: Pace = firstPace;
        const pauses: number[] = [];

        for (let i = 0; i < 10; i++) {
            pace = afterAnswer(pace, 429, null, interval, 0);
            pauses.push(pace.pauseMs);
        }

        expect(pauses.slice(0, 4)).toEqual([400, 800, 1_600, 3_200]);
        expect(pauses.at(-1)).toBe(maxPauseMs);
        expect(afterAnswer(pace, 200, null, interval, 0).pauseMs).toBe(0);
    });

    it('stops after twenty 429, 5xx or time-out answers in a row', () => {
        let pace: Pace = firstPace;
        const answers = [429, 500, null, 502, 503];

        for (let i = 0; i < streakLimit - 1; i++) {
            pace = afterAnswer(
                pace,
                answers[i % answers.length],
                '0',
                interval,
                0,
            );
        }

        expect(hasStopped(pace)).toBe(false);

        expect(hasStopped(afterAnswer(pace, null, null, interval, 0))).toBe(
            true,
        );
    });

    it('starts the count again after any other answer, a 404 included', () => {
        let pace: Pace = { ...firstPace, streak: streakLimit - 1 };

        pace = afterAnswer(pace, 404, null, interval, 0);

        expect(pace.streak).toBe(0);

        expect(hasStopped(afterAnswer(pace, 500, null, interval, 0))).toBe(
            false,
        );
    });
});

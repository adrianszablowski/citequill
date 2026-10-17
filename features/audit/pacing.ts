export interface Pace {
    pauseMs: number;
    streak: number;
    nextAt: number;
}

export const requestIntervalMs = 200;

export const maxPauseMs = 60_000;

export const streakLimit = 20;

export const stepBudgetMs = 240_000;

export const attemptsPerUrl = 3;

export const requestsInFlight = 5;

export const stoppedAnswering = `The site stopped answering or rate-limited the audit: ${streakLimit} requests in a row got a 429, a 5xx or no answer.`;

export const firstPace: Pace = { pauseMs: 0, streak: 0, nextAt: 0 };

export function takeSlot(pace: Pace, interval: number, now: number) {
    const at = Math.max(now, pace.nextAt);

    return { at, pace: { ...pace, nextAt: at + interval } };
}

export function afterAnswer(
    pace: Pace,
    status: number | null,
    retryAfter: string | null,
    interval: number,
    now: number,
): Pace {
    const streak =
        status === null || status === 429 || status >= 500
            ? pace.streak + 1
            : 0;

    if (!isRateLimit(status)) {
        return { ...pace, pauseMs: 0, streak };
    }

    const pauseMs = Math.min(
        maxPauseMs,
        retryAfterMs(retryAfter, now) ?? Math.max(interval, pace.pauseMs) * 2,
    );

    return { pauseMs, streak, nextAt: Math.max(pace.nextAt, now + pauseMs) };
}

export function isRateLimit(status: number | null) {
    return status === 429 || status === 503;
}

export function hasStopped(pace: Pace) {
    return pace.streak >= streakLimit;
}

function retryAfterMs(value: string | null, now: number) {
    if (!value) {
        return null;
    }

    if (/^\s*\d+\s*$/.test(value)) {
        return Number(value) * 1000;
    }

    const at = Date.parse(value);

    return Number.isNaN(at) ? null : Math.max(0, at - now);
}

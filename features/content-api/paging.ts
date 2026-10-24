import * as z from 'zod';

import { isPostgresTime } from '@/features/content-api/dates';

export type Endpoint = 'pages' | 'sync' | 'redirects' | 'sitemap';

export type Filters = Record<string, string | null>;

export interface Position {
    key: string;
    id: string;
}

export const pageLimits = { fallback: 20, max: 25 };

export const longLimits = { fallback: 500, max: 1_000 };

export function parseLimit(
    value: string | undefined,
    limits: { fallback: number; max: number },
) {
    if (value === undefined) {
        return limits.fallback;
    }

    return /^[1-9]\d*$/.test(value)
        ? Math.min(Number(value), limits.max)
        : null;
}

// PostgREST cuts an answer at 1 000 rows without an error, so at that limit
// the extra row that tells a next page exists never comes.
export function rowLimit(limit: number) {
    return limit >= maxRows ? maxRows : limit + 1;
}

export function pageOf<T>(rows: T[], limit: number) {
    const page = rows.slice(0, limit);

    const isLast =
        limit >= maxRows ? rows.length < maxRows : rows.length <= limit;

    return { rows: page, last: isLast ? null : (page.at(-1) ?? null) };
}

export function encodeCursor(
    endpoint: Endpoint,
    position: Position,
    filters: Filters,
) {
    return encode([endpoint, position.key, position.id, filters]);
}

export function decodeCursor(
    value: string,
    endpoint: Endpoint,
    filters: Filters,
): Position | null {
    const parsed = cursor.safeParse(decode(value));

    if (!parsed.success) {
        return null;
    }

    const [cursorEndpoint, key, id, cursorFilters] = parsed.data;

    const isFit =
        cursorEndpoint === endpoint &&
        JSON.stringify(sorted(cursorFilters)) ===
            JSON.stringify(sorted(filters));

    return isFit ? { key, id } : null;
}

export function encodeSyncToken(readAt: string) {
    return encode([
        'sync',
        new Date(Date.parse(readAt) - syncLeadMs).toISOString(),
    ]);
}

export function decodeSyncToken(value: string, now: number) {
    const parsed = syncToken.safeParse(decode(value));

    if (!parsed.success) {
        return null;
    }

    const age = now - Date.parse(parsed.data[1]);

    return age >= 0 && age <= syncTokenDays * dayMs ? parsed.data[1] : null;
}

export const syncStart = new Date(0).toISOString();

export const syncTokenDays = 30;

function encode(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value: string) {
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString());
    } catch {
        return null;
    }
}

function sorted(filters: Filters) {
    return Object.fromEntries(
        Object.entries(filters).sort(([a], [b]) => a.localeCompare(b)),
    );
}

const maxRows = 1_000;

const syncLeadMs = 5_000;

const dayMs = 24 * 60 * 60 * 1_000;

const cursor = z.tuple([
    z.enum(['pages', 'sync', 'redirects', 'sitemap']),
    z.string().refine(isPostgresTime),
    z.uuid(),
    z.record(z.string(), z.string().nullable()),
]);

const syncToken = z.tuple([z.literal('sync'), z.iso.datetime()]);

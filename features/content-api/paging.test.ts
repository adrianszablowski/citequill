import { describe, expect, it } from 'vitest';

import {
    decodeCursor,
    decodeSyncToken,
    encodeCursor,
    encodeSyncToken,
    longLimits,
    pageLimits,
    pageOf,
    parseLimit,
    rowLimit,
} from '@/features/content-api/paging';

const position = {
    key: '2026-10-15T06:12:00.123456+00:00',
    id: '6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f',
};

describe('parseLimit', () => {
    it('falls back to the default when the request names none', () => {
        expect(parseLimit(undefined, pageLimits)).toBe(20);
        expect(parseLimit(undefined, longLimits)).toBe(500);
    });

    it('lowers a larger limit to the cap', () => {
        expect(parseLimit('26', pageLimits)).toBe(25);
        expect(parseLimit('5000', longLimits)).toBe(1_000);
    });

    it('refuses a limit that is not a whole number from 1', () => {
        for (const value of ['0', '-1', '2.5', 'ten', '', '07']) {
            expect(parseLimit(value, pageLimits)).toBeNull();
        }
    });
});

describe('rowLimit and pageOf', () => {
    it('asks for one row more than the limit and knows a next page from it', () => {
        expect(rowLimit(20)).toBe(21);

        const rows = Array.from({ length: 21 }, (_, index) => index);

        expect(pageOf(rows, 20)).toEqual({
            rows: rows.slice(0, 20),
            last: 19,
        });
    });

    it('has no next page when the extra row does not come', () => {
        expect(pageOf([1, 2, 3], 20)).toEqual({ rows: [1, 2, 3], last: null });
        expect(pageOf([], 20)).toEqual({ rows: [], last: null });
    });

    it('asks for 1 000 rows at the cap and gives a full page a next page', () => {
        expect(rowLimit(1_000)).toBe(1_000);

        const full = Array.from({ length: 1_000 }, (_, index) => index);

        expect(pageOf(full, 1_000).last).toBe(999);
        expect(pageOf(full.slice(1), 1_000).last).toBeNull();
    });
});

describe('cursors', () => {
    it('gives back the position it holds, the timestamp to the microsecond', () => {
        const cursor = encodeCursor('pages', position, {
            locale: 'pl',
            kind: null,
        });

        expect(
            decodeCursor(cursor, 'pages', { kind: null, locale: 'pl' }),
        ).toEqual(position);
    });

    it('refuses a cursor of another endpoint or other filters', () => {
        const cursor = encodeCursor('pages', position, {
            locale: 'pl',
            kind: null,
        });

        expect(decodeCursor(cursor, 'sitemap', {})).toBeNull();

        expect(
            decodeCursor(cursor, 'pages', { locale: 'en', kind: null }),
        ).toBeNull();
    });

    it('refuses a malformed cursor', () => {
        expect(decodeCursor('not a cursor', 'pages', {})).toBeNull();

        expect(
            decodeCursor(
                Buffer.from('["pages","yesterday","x",{}]').toString(
                    'base64url',
                ),
                'pages',
                {},
            ),
        ).toBeNull();
    });
});

describe('a cursor holding a time Postgres would refuse', () => {
    function tampered(key: string) {
        return Buffer.from(
            JSON.stringify(['pages', key, position.id, {}]),
        ).toString('base64url');
    }

    it('refuses a timestamp whose fields are not a real time', () => {
        for (const key of [
            '9999-99-99T99:99:99Z',
            '2026-02-30 06:12:00+00',
            '2026-10-15T24:00:00+00:00',
            '2026-10-15T06:12:60+00:00',
            '0000-01-01T00:00:00+00:00',
        ]) {
            expect(decodeCursor(tampered(key), 'pages', {})).toBeNull();
        }
    });

    it('refuses an offset Postgres does not take and a time past year 9999', () => {
        expect(
            decodeCursor(tampered('2026-10-15T06:12:00+99:00'), 'pages', {}),
        ).toBeNull();

        expect(
            decodeCursor(tampered('9999-12-31T23:59:59-15:00'), 'pages', {}),
        ).toBeNull();
    });

    it('keeps the forms Postgres writes', () => {
        for (const key of [
            '2026-10-15 06:12:00+00',
            '2026-10-15T06:12:00.123456+00:00',
            '2026-10-15T06:12:00+0530',
        ]) {
            expect(decodeCursor(tampered(key), 'pages', {})).toEqual({
                key,
                id: position.id,
            });
        }
    });
});

describe('sync tokens', () => {
    const readAt = '2026-10-15T06:12:00.000Z';
    const now = Date.parse(readAt);

    it('holds a time 5 seconds before the read', () => {
        expect(decodeSyncToken(encodeSyncToken(readAt), now)).toBe(
            '2026-10-15T06:11:55.000Z',
        );
    });

    it('expires after 30 days', () => {
        const token = encodeSyncToken(readAt);
        const day = 24 * 60 * 60 * 1_000;

        const issued = now - 5_000;

        expect(decodeSyncToken(token, issued + 30 * day)).not.toBeNull();
        expect(decodeSyncToken(token, issued + 30 * day + 1)).toBeNull();
    });

    it('refuses what is not a token, a cursor included', () => {
        expect(decodeSyncToken('start', now)).toBeNull();

        expect(
            decodeSyncToken(encodeCursor('sync', position, {}), now),
        ).toBeNull();
    });
});

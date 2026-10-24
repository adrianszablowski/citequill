import { describe, expect, it } from 'vitest';

import { apiDate, parseRfc3339 } from '@/features/content-api/dates';

describe('apiDate', () => {
    it('writes UTC with Z and exactly 3 fractional digits', () => {
        expect(apiDate('2026-10-15T06:12:00+00:00')).toBe(
            '2026-10-15T06:12:00.000Z',
        );
    });

    it('cuts the microseconds Postgres writes to milliseconds', () => {
        expect(apiDate('2026-10-15T06:12:00.123456+00:00')).toBe(
            '2026-10-15T06:12:00.123Z',
        );
    });

    it('moves another offset to UTC', () => {
        expect(apiDate('2026-10-15T08:12:00.5+02:00')).toBe(
            '2026-10-15T06:12:00.500Z',
        );
    });

    it('reads the space Postgres writes between the date and the time', () => {
        expect(apiDate('2026-10-15 06:12:00+00')).toBe(
            '2026-10-15T06:12:00.000Z',
        );
    });

    it('throws on a string that is not a date', () => {
        expect(() => apiDate('yesterday')).toThrow();
    });
});

describe('parseRfc3339', () => {
    it('takes any offset and returns the date in UTC', () => {
        expect(parseRfc3339('2026-10-15T08:12:00+02:00')).toBe(
            '2026-10-15T06:12:00.000Z',
        );

        expect(parseRfc3339('2026-10-15T06:12:00.123456Z')).toBe(
            '2026-10-15T06:12:00.123Z',
        );
    });

    it('refuses a bare + turned into a space by the query string', () => {
        expect(parseRfc3339('2026-10-15T08:12:00 02:00')).toBeNull();
    });

    it('refuses a date with no offset, a day that does not exist or a bare date', () => {
        expect(parseRfc3339('2026-10-15T06:12:00')).toBeNull();
        expect(parseRfc3339('2026-02-30T06:12:00Z')).toBeNull();
        expect(parseRfc3339('2026-10-15')).toBeNull();
        expect(parseRfc3339('2026-10-15T25:12:00Z')).toBeNull();
    });

    it('refuses a date that falls after year 9999 in UTC', () => {
        expect(parseRfc3339('9999-12-31T23:59:59-23:59')).toBeNull();

        expect(parseRfc3339('9999-12-31T23:59:59Z')).toBe(
            '9999-12-31T23:59:59.000Z',
        );
    });
});

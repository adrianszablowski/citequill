import { describe, expect, it } from 'vitest';

import { findingsPerPage } from '@/features/audit/finding';
import {
    altAsShown,
    ancestorAsShown,
    changesLine,
    detailLines,
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

describe('altAsShown', () => {
    it('tells an absent, an empty and a whitespace alt apart in words', () => {
        expect(altAsShown('absent')).toBe('No alt attribute');
        expect(altAsShown('empty')).toBe('Empty alt');
        expect(altAsShown('whitespace')).toBe('Whitespace alt');
    });

    it('quotes any other alt as found', () => {
        expect(altAsShown('Acme logo')).toBe('"Acme logo"');
        expect(altAsShown('constructor')).toBe('"constructor"');
    });
});

describe('ancestorAsShown', () => {
    it('names the ancestor that decided the verdict', () => {
        expect(ancestorAsShown('link')).toBe('In a link');
        expect(ancestorAsShown('figure')).toBe('In a figure');
    });
});

describe('detailLines', () => {
    it('writes one labelled line per key the customer can act on', () => {
        expect(
            detailLines({
                missing: [
                    'strict-transport-security',
                    'content-security-policy',
                ],
                code: 'CERT_HAS_EXPIRED',
                status: 404,
            }),
        ).toEqual([
            'Missing: strict-transport-security, content-security-policy',
            'Code: CERT_HAS_EXPIRED',
            'Status: 404',
        ]);
    });

    it('hides the keys the audit keeps for itself and the values with nothing to show', () => {
        expect(
            detailLines({
                reason: 'no-redirect',
                hops: [{ url: 'http://acme.com/', status: 301 }],
                isNoindex: true,
                error: null,
                missing: [],
                finalUrl: 'http://acme.com/',
            }),
        ).toEqual(['Final URL: http://acme.com/']);
    });

    it('shows both times of a slow page with the region it was read from, and the half of assets-heavy by its count alone', () => {
        expect(detailLines({ ms: [1240, 1810], region: 'fra1' })).toEqual([
            'Time (ms): 1,240, 1,810',
            'Region: fra1',
        ]);

        expect(
            detailLines({ reason: 'bytes', bytes: 2_400_000, files: 38 }),
        ).toEqual(['Bytes: 2,400,000', 'Files: 38']);
    });

    it('spells out the counts of a nested record', () => {
        expect(
            detailLines({
                reasons: ['headings', 'words'],
                desktop: { headings: 12, words: 1840, links: 30 },
                phone: { headings: 8, words: 900, links: 30 },
            }),
        ).toEqual([
            'Reasons: headings, words',
            'Desktop: headings 12, words 1,840, links 30',
            'Phone: headings 8, words 900, links 30',
        ]);
    });

    it('counts the elements beyond the 20 listed, and says nothing when all are listed', () => {
        expect(detailLines({ total: findingsPerPage + 14 })).toEqual([
            'and 14 more',
        ]);

        expect(detailLines({ total: findingsPerPage })).toEqual([]);
    });

    it('shows nothing for a finding with no detail', () => {
        expect(detailLines(null)).toEqual([]);
        expect(detailLines(undefined)).toEqual([]);
        expect(detailLines('served')).toEqual([]);
    });
});

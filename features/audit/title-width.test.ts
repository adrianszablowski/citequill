import { describe, expect, it } from 'vitest';

import { titleWidth, titleWidthLimit } from '@/features/audit/title-width';

describe('titleWidth', () => {
    it('measures each glyph at its Arial advance, 20 px to the em', () => {
        expect(titleWidth(' ')).toBeCloseTo(5.56);
        expect(titleWidth('a')).toBeCloseTo(11.12);
        expect(titleWidth('i')).toBeCloseTo(4.44);
        expect(titleWidth('m')).toBeCloseTo(16.66);
        expect(titleWidth('W')).toBeCloseTo(18.88);
    });

    it('gives "Display" and "iiiiiii", seven characters each, different widths', () => {
        expect(titleWidth('Display')).toBeCloseTo(65.56);
        expect(titleWidth('iiiiiii')).toBeCloseTo(31.08);
    });

    it('measures a letter with a diacritic as its base letter, and ł as l', () => {
        expect(titleWidth('Zażółć gęślą jaźń')).toBeCloseTo(
            titleWidth('Zazolc gesla jazn'),
        );

        expect(titleWidth('Łódź')).toBeCloseTo(titleWidth('Lodz'));
    });

    it('measures any other glyph at the average width', () => {
        expect(titleWidth('–')).toBeCloseTo(11.12);
        expect(titleWidth('漢字')).toBeCloseTo(22.24);
    });

    it('is 0 for an empty title, and passes the limit on a long one', () => {
        expect(titleWidth('')).toBe(0);

        expect(
            titleWidth(
                'Księgowość dla małych firm w Warszawie: cennik, opinie i porady | Biuro Rachunkowe Kowalski',
            ),
        ).toBeGreaterThan(titleWidthLimit);
    });
});

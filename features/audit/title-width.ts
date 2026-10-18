export const titleWidthLimit = 600;

export function titleWidth(text: string) {
    const letters = text
        .replace(/ł/g, 'l')
        .replace(/Ł/g, 'L')
        .normalize('NFD')
        .replace(/\p{M}/gu, '');

    const units = [...letters].reduce(
        (sum, glyph) => sum + (advances.get(glyph) ?? averageAdvance),
        0,
    );

    return (units * fontSize) / unitsPerEm;
}

const fontSize = 20;

const unitsPerEm = 1000;

const averageAdvance = 556;

const advances = new Map(
    (
        [
            [191, "'"],
            [222, 'ijl'],
            [260, '|'],
            [278, ' !,./:;I[\\]ft'],
            [333, '()-`r'],
            [334, '{}'],
            [355, '"'],
            [389, '*'],
            [469, '^'],
            [500, 'Jcksvxyz'],
            [556, '#$0123456789?L_abdeghnopqu'],
            [584, '+<=>~'],
            [611, 'FTZ'],
            [667, '&ABEKPSVXY'],
            [722, 'CDHNRUw'],
            [778, 'GOQ'],
            [833, 'Mm'],
            [889, '%'],
            [944, 'W'],
            [1015, '@'],
        ] as const
    ).flatMap(([advance, glyphs]) =>
        [...glyphs].map((glyph) => [glyph, advance] as const),
    ),
);

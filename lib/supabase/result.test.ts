import { describe, expect, it } from 'vitest';

import { all, rowsPerRead } from '@/lib/supabase/result';

function table(size: number) {
    const ranges: [number, number][] = [];
    const rows = Array.from({ length: size }, (_, index) => index);

    return {
        ranges,
        range: async (from: number, to: number) => {
            ranges.push([from, to]);

            return {
                data: rows.slice(from, to + 1),
                error: null,
                count: null,
                status: 200,
                statusText: 'OK',
                success: true as const,
            };
        },
    };
}

describe('all', () => {
    it('reads page after page until a page comes back short', async () => {
        const { ranges, range } = table(rowsPerRead * 2 + 5);

        expect(await all(range)).toHaveLength(rowsPerRead * 2 + 5);

        expect(ranges.map(([from]) => from)).toEqual([
            0,
            rowsPerRead,
            rowsPerRead * 2,
        ]);
    });

    it('asks once more after a full last page, and once for an empty table', async () => {
        const full = table(rowsPerRead);

        expect(await all(full.range)).toHaveLength(rowsPerRead);
        expect(full.ranges).toHaveLength(2);

        const empty = table(0);

        expect(await all(empty.range)).toEqual([]);
        expect(empty.ranges).toHaveLength(1);
    });

    it('throws the error of a page that fails and asks for no page after it', async () => {
        const { ranges, range } = table(rowsPerRead * 3);

        const read = all(async (from: number, to: number) => {
            const page = await range(from, to);

            return from === 0
                ? page
                : ({
                      data: null,
                      error: { message: 'statement timeout' },
                      count: null,
                      status: 500,
                      statusText: 'Internal Server Error',
                      success: false,
                  } as never);
        });

        await expect(read).rejects.toThrow('statement timeout');
        expect(ranges.map(([from]) => from)).toEqual([0, rowsPerRead]);
    });
});

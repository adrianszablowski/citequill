import { describe, expect, it } from 'vitest';

import { richResults } from '@/features/audit/rich-results';

describe('richResults', () => {
    it('links every feature to its page in Google’s gallery, and lists every alternative of a one-of once', () => {
        for (const { url, required, recommended } of richResults) {
            expect(url).toMatch(
                /^https:\/\/developers\.google\.com\/search\/docs\/appearance\/structured-data\/[a-z-]+$/,
            );

            for (const entry of [...required, ...recommended]) {
                const alternatives = [entry].flat();

                expect(new Set(alternatives).size, url).toBe(
                    alternatives.length,
                );
            }
        }
    });

    it('gives a Product the merchant listing or the product snippet lists, one each', () => {
        expect(
            richResults
                .filter((result) => result.types.includes('Product'))
                .map(({ feature, isMerchantListing }) => [
                    feature,
                    isMerchantListing,
                ]),
        ).toEqual([
            ['merchant listing', true],
            ['product snippet', false],
        ]);
    });
});

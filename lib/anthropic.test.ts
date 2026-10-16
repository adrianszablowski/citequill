import { describe, expect, it } from 'vitest';

import { costUsd, models } from '@/lib/anthropic';

describe('costUsd', () => {
    it('prices input and output tokens per million for the model', () => {
        expect(
            costUsd(models.extractor, {
                input_tokens: 1_000_000,
                output_tokens: 100_000,
            }),
        ).toBe(3);

        expect(
            costUsd(models.writer, { input_tokens: 500_000, output_tokens: 0 }),
        ).toBe(2);
    });

    it('is zero for no tokens', () => {
        expect(
            costUsd(models.writer, { input_tokens: 0, output_tokens: 0 }),
        ).toBe(0);
    });
});

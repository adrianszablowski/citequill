import { describe, expect, it } from 'vitest';

import { models } from '@/lib/anthropic';
import { costUsd } from '@/lib/pricing';

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

    it('adds every web search at its price per thousand', () => {
        expect(
            costUsd(models.writer, {
                input_tokens: 0,
                output_tokens: 0,
                server_tool_use: { web_search_requests: 5 },
            }),
        ).toBe(0.05);
    });

    it('is zero for no tokens and no searches', () => {
        expect(
            costUsd(models.writer, {
                input_tokens: 0,
                output_tokens: 0,
                server_tool_use: null,
            }),
        ).toBe(0);
    });
});

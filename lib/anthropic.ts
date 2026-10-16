import Anthropic from '@anthropic-ai/sdk';

export const models = {
    writer: 'claude-opus-5-5',
    extractor: 'claude-sonnet-5-5',
} as const;

export type ModelId = (typeof models)[keyof typeof models];

export interface Usage {
    input_tokens: number;
    output_tokens: number;
}

export function createAnthropic() {
    return new Anthropic();
}

export function costUsd(model: ModelId, usage: Usage) {
    const price = pricePerMillion[model];

    return (
        (usage.input_tokens * price.input +
            usage.output_tokens * price.output) /
        1_000_000
    );
}

// USD per million tokens; the numbers come from
// docs/research/2026-10-13-seo-autopilot-costs.md and change only with it.
const pricePerMillion: Record<ModelId, { input: number; output: number }> = {
    'claude-opus-5-5': { input: 4, output: 20 },
    'claude-sonnet-5-5': { input: 2, output: 10 },
};

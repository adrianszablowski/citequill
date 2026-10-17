import Anthropic from '@anthropic-ai/sdk';

export const models = {
    writer: 'claude-opus-5-5',
    extractor: 'claude-sonnet-5-5',
} as const;

export type ModelId = (typeof models)[keyof typeof models];

export function createAnthropic() {
    return new Anthropic();
}

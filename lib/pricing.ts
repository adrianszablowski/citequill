import type { ModelId } from '@/lib/anthropic';

export interface Usage {
    input_tokens: number;
    output_tokens: number;
    server_tool_use?: { web_search_requests: number } | null;
}

export function costUsd(model: ModelId, usage: Usage) {
    const price = tokenPricePerMillion[model];

    const tokens =
        (usage.input_tokens * price.input +
            usage.output_tokens * price.output) /
        1_000_000;

    const searches =
        ((usage.server_tool_use?.web_search_requests ?? 0) *
            webSearchPricePerThousand) /
        1_000;

    return tokens + searches;
}

// USD; the numbers come from docs/research/2026-10-13-seo-autopilot-costs.md
// and change only with it.
const tokenPricePerMillion: Record<ModelId, { input: number; output: number }> =
    {
        'claude-opus-5-5': { input: 4, output: 20 },
        'claude-sonnet-5-5': { input: 2, output: 10 },
    };

const webSearchPricePerThousand = 10;

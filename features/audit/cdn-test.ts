import type { Finding } from '@/features/audit/finding';
import { cdnTestAgents } from '@/features/audit/robots';
import {
    bingbotUserAgent,
    desktopUserAgent,
    type Fetched,
    googlebotUserAgent,
    userAgent,
} from '@/features/crawl/fetch';

export type CdnOutcome =
    'passed' | 'browser-refused' | 'bot-refused' | 'spoof-refused';

export type ReadAs = (userAgent: string) => Promise<Fetched | Error | null>;

export interface AgentAnswer {
    agent: string;
    answer: Fetched | Error;
}

export async function runCdnTest(
    home: string,
    readAs: ReadAs,
    disallowed: string[],
): Promise<{ outcome: CdnOutcome | null; findings: Finding[] }> {
    for (const [control, refused] of controls) {
        const answer = await readAs(control);

        if (
            answer === null ||
            answer instanceof Error ||
            answer.status >= 500
        ) {
            return { outcome: null, findings: [] };
        }

        // A 429 is a refusal here, because Vercel's Security Checkpoint answers
        // a browser with one.
        if (answer.status !== 200) {
            return { outcome: refused, findings: [] };
        }
    }

    const answers: AgentAnswer[] = [];

    for (const { agent, userAgent: sent } of cdnTestAgents) {
        const answer = await readAs(sent);

        if (answer === null) {
            return { outcome: null, findings: [] };
        }

        answers.push({ agent, answer });
    }

    // A rate limit that starts partway through the test refuses the last agents
    // as a rule by name would, so the browser must still get through after them.
    const closing = await readAs(desktopUserAgent);

    if (
        closing === null ||
        closing instanceof Error ||
        closing.status !== 200
    ) {
        return { outcome: null, findings: [] };
    }

    return {
        outcome: 'passed',
        findings: cdnFindings(home, answers, disallowed),
    };
}

export function agentVerdict(answer: Fetched | Error) {
    if (answer instanceof Error) {
        return null;
    }

    if (crawlerPrice(answer) !== null) {
        return 'charged';
    }

    // Shopify's edge answers a rate limit with a 429 challenge, which says
    // nothing about a rule that names the agent.
    return answer.status >= 400 && answer.status < 500 && answer.status !== 429
        ? 'refused'
        : null;
}

export function cdnOf(headers: Headers) {
    if (headers.has('x-vercel-id')) {
        return 'Vercel';
    }

    return headers.has('cf-ray') ? 'Cloudflare' : null;
}

export function cdnFindings(
    home: string,
    answers: AgentAnswer[],
    disallowed: string[],
): Finding[] {
    const allowed = answers.filter(({ agent }) => !disallowed.includes(agent));

    const refused = allowed.filter(
        ({ answer }) => agentVerdict(answer) === 'refused',
    );

    const charged = allowed.flatMap(({ agent, answer }) => {
        const price = crawlerPrice(answer);

        return price === null ? [] : [[agent, price] as const];
    });

    return [
        ...(refused.length > 0
            ? [
                  {
                      check: 'ai-cdn-blocked' as const,
                      url: null,
                      subject: home,
                      detail: {
                          agents: refused.map(({ agent }) => agent),
                          answers: Object.fromEntries(
                              answers.map(({ agent, answer }) => [
                                  agent,
                                  answerAsShown(answer),
                              ]),
                          ),
                      },
                  },
              ]
            : []),
        ...(charged.length > 0
            ? [
                  {
                      check: 'pay-per-crawl' as const,
                      url: null,
                      subject: home,
                      detail: { prices: Object.fromEntries(charged) },
                  },
              ]
            : []),
    ];
}

const controls = [
    [desktopUserAgent, 'browser-refused'],
    [userAgent, 'bot-refused'],
    [googlebotUserAgent, 'spoof-refused'],
    [bingbotUserAgent, 'spoof-refused'],
] as const;

function crawlerPrice(answer: Fetched | Error) {
    return answer instanceof Error || answer.status !== 402
        ? null
        : answer.headers.get('crawler-price')?.trim() || null;
}

function isChallenge(headers: Headers) {
    return headers.get('cf-mitigated')?.trim().toLowerCase() === 'challenge';
}

function answerAsShown(answer: Fetched | Error) {
    if (answer instanceof Error) {
        return 'no answer';
    }

    const notes = [
        agentVerdict(answer) === 'refused' ? cdnOf(answer.headers) : null,
        isChallenge(answer.headers) ? 'challenge' : null,
    ].filter((note) => note !== null);

    return notes.length > 0
        ? `${answer.status} (${notes.join(' ')})`
        : String(answer.status);
}

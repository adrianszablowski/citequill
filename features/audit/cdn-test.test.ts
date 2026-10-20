import { describe, expect, it } from 'vitest';

import {
    agentVerdict,
    cdnFindings,
    cdnOf,
    runCdnTest,
} from '@/features/audit/cdn-test';
import { cdnTestAgents } from '@/features/audit/robots';
import {
    bingbotUserAgent,
    desktopUserAgent,
    type Fetched,
    googlebotUserAgent,
    userAgent,
} from '@/features/crawl/fetch';

const home = 'https://acme.com/';

function answer(
    status: number,
    headers: Record<string, string> = {},
    url = home,
): Fetched {
    return {
        ok: status < 400,
        status,
        url,
        headers: new Headers(headers),
        body: '',
        bytes: 0,
        isUtf8: true,
        isTruncated: false,
        hops: [{ url: home, status }],
        headersMs: 0,
    };
}

function reading(answers: (agent: string) => Fetched | Error | null) {
    const asked: string[] = [];

    return {
        asked,
        readAs: async (sent: string) => {
            asked.push(sent);

            return answers(sent);
        },
    };
}

const controls = [
    desktopUserAgent,
    userAgent,
    googlebotUserAgent,
    bingbotUserAgent,
];

const agentOf = (sent: string) =>
    cdnTestAgents.find(({ userAgent: value }) => value === sent)?.agent;

describe('runCdnTest', () => {
    it('asks the browser control, CitequillBot alone, a claimed Googlebot and a claimed Bingbot, then the 8 agents, then the browser again, and passes when all five control requests get a 200', async () => {
        const { asked, readAs } = reading(() => answer(200));

        expect(await runCdnTest(home, readAs, [])).toEqual({
            outcome: 'passed',
            findings: [],
        });

        expect(asked).toEqual([
            ...controls,
            ...cdnTestAgents.map(({ userAgent: sent }) => sent),
            desktopUserAgent,
        ]);
    });

    it('stops at the first control that is not a 200, with its outcome, and asks nothing after it', async () => {
        const outcomes = [
            'browser-refused',
            'bot-refused',
            'spoof-refused',
            'spoof-refused',
        ];

        for (const [index, failing] of controls.entries()) {
            const { asked, readAs } = reading((sent) =>
                sent === failing
                    ? answer(403, {
                          'cf-ray': '1',
                          'cf-mitigated': 'challenge',
                      })
                    : answer(200),
            );

            expect(await runCdnTest(home, readAs, []), failing).toEqual({
                outcome: outcomes[index],
                findings: [],
            });

            expect(asked, failing).toEqual(controls.slice(0, index + 1));
        }
    });

    it('gives a control’s 429 that control’s refused outcome, because a security checkpoint answers a browser with one', async () => {
        const outcomes = [
            'browser-refused',
            'bot-refused',
            'spoof-refused',
            'spoof-refused',
        ];

        for (const [index, failing] of controls.entries()) {
            const { readAs } = reading((sent) =>
                sent === failing ? answer(429) : answer(200),
            );

            expect(await runCdnTest(home, readAs, []), failing).toEqual({
                outcome: outcomes[index],
                findings: [],
            });
        }
    });

    it('has no outcome when a control gets a 5xx, and asks nothing after it, because a server error refuses nothing', async () => {
        for (const [index, failing] of controls.entries()) {
            const { asked, readAs } = reading((sent) =>
                sent === failing
                    ? answer(503, { 'cf-mitigated': 'challenge' })
                    : answer(200),
            );

            expect(await runCdnTest(home, readAs, []), failing).toEqual({
                outcome: null,
                findings: [],
            });

            expect(asked, failing).toEqual(controls.slice(0, index + 1));
        }
    });

    it('has no outcome and no finding when the browser asked again after the agents gets a 403, an error or no answer', async () => {
        for (const closing of [answer(403), new Error('timed out'), null]) {
            let browserAsks = 0;

            const { asked, readAs } = reading((sent) => {
                if (sent === desktopUserAgent) {
                    browserAsks += 1;

                    return browserAsks === 1 ? answer(200) : closing;
                }

                return agentOf(sent) === 'PerplexityBot'
                    ? answer(403)
                    : answer(200);
            });

            expect(await runCdnTest(home, readAs, []), String(closing)).toEqual(
                { outcome: null, findings: [] },
            );

            expect(asked).toHaveLength(
                controls.length + cdnTestAgents.length + 1,
            );
        }
    });

    it('passes a control whose redirect to another host ends in a 200', async () => {
        const { readAs } = reading(() =>
            answer(200, {}, 'https://www.acme-shop.com/'),
        );

        expect((await runCdnTest(home, readAs, [])).outcome).toBe('passed');
    });

    it('has no outcome when a control gets no answer, because a time-out refuses nothing', async () => {
        for (const failing of controls) {
            const { asked, readAs } = reading((sent) =>
                sent === failing ? new Error('timed out') : answer(200),
            );

            expect(await runCdnTest(home, readAs, [])).toEqual({
                outcome: null,
                findings: [],
            });

            expect(asked.at(-1), failing).toBe(failing);
        }
    });

    it('has no outcome when the claimed Googlebot gets no answer, and asks nothing after it', async () => {
        const { asked, readAs } = reading((sent) =>
            sent === googlebotUserAgent ? new Error('timed out') : answer(200),
        );

        expect(await runCdnTest(home, readAs, [])).toEqual({
            outcome: null,
            findings: [],
        });

        expect(asked).toEqual([
            desktopUserAgent,
            userAgent,
            googlebotUserAgent,
        ]);
    });

    it('passes only after all four controls, all 8 agents and the browser again were read, 13 reads', async () => {
        const { readAs } = reading((sent) =>
            sent === cdnTestAgents.at(-1)!.userAgent ? null : answer(200),
        );

        expect((await runCdnTest(home, readAs, [])).outcome).toBeNull();

        const full = reading(() => answer(200));

        expect((await runCdnTest(home, full.readAs, [])).outcome).toBe(
            'passed',
        );

        expect(full.asked).toHaveLength(13);
    });

    it('has no outcome and no finding when the step budget runs out before a control or midway through the agents', async () => {
        expect(await runCdnTest(home, reading(() => null).readAs, [])).toEqual({
            outcome: null,
            findings: [],
        });

        const midway = reading((sent) => {
            const agent = agentOf(sent);

            if (agent === 'Applebot') {
                return null;
            }

            return agent ? answer(403) : answer(200);
        });

        expect(await runCdnTest(home, midway.readAs, [])).toEqual({
            outcome: null,
            findings: [],
        });

        expect(midway.asked).toHaveLength(controls.length + 4);
    });

    it('reports the agents refused by name with every agent’s answer, and an agent with no answer as asked', async () => {
        const { readAs } = reading((sent) => {
            const agent = agentOf(sent);

            if (agent === 'PerplexityBot') {
                return answer(403, { 'cf-ray': '1' });
            }

            return agent === 'DuckAssistBot'
                ? new Error('timed out')
                : answer(200);
        });

        expect(await runCdnTest(home, readAs, [])).toEqual({
            outcome: 'passed',
            findings: [
                {
                    check: 'ai-cdn-blocked',
                    url: null,
                    subject: home,
                    detail: {
                        agents: ['PerplexityBot'],
                        answers: {
                            'OAI-SearchBot': '200',
                            'Claude-SearchBot': '200',
                            PerplexityBot: '403 (Cloudflare)',
                            Applebot: '200',
                            'MistralAI-Index': '200',
                            DuckAssistBot: 'no answer',
                            'Amzn-SearchBot': '200',
                            'meta-webindexer': '200',
                        },
                    },
                },
            ],
        });
    });

    it('leaves the agents robots.txt disallows out of the refused agents, and keeps their answers', async () => {
        const { readAs } = reading((sent) =>
            ['PerplexityBot', 'Applebot'].includes(agentOf(sent) ?? '')
                ? answer(403)
                : answer(200),
        );

        const { findings } = await runCdnTest(home, readAs, ['PerplexityBot']);

        expect(findings).toMatchObject([
            {
                check: 'ai-cdn-blocked',
                detail: {
                    agents: ['Applebot'],
                    answers: { PerplexityBot: '403', Applebot: '403' },
                },
            },
        ]);
    });
});

describe('agentVerdict', () => {
    it('refuses every 4xx but 429, a 402 without a crawler-price header among them', () => {
        for (const status of [400, 401, 402, 403, 404, 406, 410, 451, 471]) {
            expect(agentVerdict(answer(status)), String(status)).toBe(
                'refused',
            );
        }

        expect(agentVerdict(answer(402, { 'crawler-price': ' ' }))).toBe(
            'refused',
        );

        expect(agentVerdict(answer(403, { 'cf-mitigated': 'challenge' }))).toBe(
            'refused',
        );
    });

    it('charges a 402 with a crawler-price header, with a challenge or without', () => {
        expect(agentVerdict(answer(402, { 'crawler-price': 'USD 0.01' }))).toBe(
            'charged',
        );

        expect(
            agentVerdict(
                answer(402, {
                    'crawler-price': 'USD 0.01',
                    'cf-mitigated': 'challenge',
                }),
            ),
        ).toBe('charged');
    });

    it('gives nothing for a 200, a redirect, a 429, a 5xx or no answer, with a challenge or without', () => {
        for (const status of [200, 301, 429, 500, 503]) {
            expect(agentVerdict(answer(status)), String(status)).toBeNull();

            expect(
                agentVerdict(answer(status, { 'cf-mitigated': 'Challenge' })),
                `${status} with a challenge`,
            ).toBeNull();
        }

        expect(agentVerdict(new Error('timed out'))).toBeNull();
    });
});

describe('cdnOf', () => {
    it('names Vercel by x-vercel-id even behind Cloudflare, else Cloudflare by cf-ray, else none', () => {
        expect(
            cdnOf(new Headers({ 'x-vercel-id': 'fra1::abc', 'cf-ray': '1' })),
        ).toBe('Vercel');

        expect(cdnOf(new Headers({ 'cf-ray': '1' }))).toBe('Cloudflare');
        expect(cdnOf(new Headers())).toBeNull();
    });
});

describe('cdnFindings', () => {
    const answers = (byAgent: Record<string, Fetched>) =>
        cdnTestAgents.map(({ agent }) => ({
            agent,
            answer: byAgent[agent] ?? answer(200),
        }));

    it('gives one finding for every refused agent, naming the CDN of each refused answer and a challenge', () => {
        const [finding] = cdnFindings(
            home,
            answers({
                'OAI-SearchBot': answer(403, {
                    'x-vercel-id': 'fra1::abc',
                    'cf-ray': '1',
                }),
                Applebot: answer(503, {
                    'cf-ray': '1',
                    'cf-mitigated': 'challenge',
                }),
                PerplexityBot: answer(403, {
                    'cf-ray': '1',
                    'cf-mitigated': 'challenge',
                }),
                'meta-webindexer': answer(403),
            }),
            [],
        );

        expect(finding).toMatchObject({
            check: 'ai-cdn-blocked',
            url: null,
            subject: home,
            detail: {
                agents: ['OAI-SearchBot', 'PerplexityBot', 'meta-webindexer'],
                answers: {
                    'OAI-SearchBot': '403 (Vercel)',
                    Applebot: '503 (challenge)',
                    PerplexityBot: '403 (Cloudflare challenge)',
                    'meta-webindexer': '403',
                    'Claude-SearchBot': '200',
                },
            },
        });
    });

    it('gives no block when every refused agent is one robots.txt disallows', () => {
        expect(
            cdnFindings(
                home,
                answers({
                    PerplexityBot: answer(403),
                    'Claude-SearchBot': answer(406),
                }),
                ['PerplexityBot', 'Claude-SearchBot', 'Applebot'],
            ),
        ).toEqual([]);
    });

    it('gives no price for a charged agent robots.txt disallows, and keeps the others', () => {
        const charged = answers({
            PerplexityBot: answer(402, { 'crawler-price': 'USD 0.01' }),
            'MistralAI-Index': answer(402, { 'crawler-price': 'USD 0.02' }),
        });

        expect(
            cdnFindings(home, charged, ['PerplexityBot']).map(
                ({ detail }) => detail,
            ),
        ).toEqual([{ prices: { 'MistralAI-Index': 'USD 0.02' } }]);

        expect(
            cdnFindings(home, charged, ['PerplexityBot', 'MistralAI-Index']),
        ).toEqual([]);
    });

    it('gives one pay-per-crawl finding with the price of each charged agent, and no block for it', () => {
        expect(
            cdnFindings(
                home,
                answers({
                    PerplexityBot: answer(402, { 'crawler-price': 'USD 0.01' }),
                    'MistralAI-Index': answer(402, {
                        'crawler-price': 'USD 0.02',
                    }),
                }),
                [],
            ),
        ).toEqual([
            {
                check: 'pay-per-crawl',
                url: null,
                subject: home,
                detail: {
                    prices: {
                        PerplexityBot: 'USD 0.01',
                        'MistralAI-Index': 'USD 0.02',
                    },
                },
            },
        ]);
    });

    it('gives a block and a price side by side, and nothing when every agent got through or failed', () => {
        expect(
            cdnFindings(
                home,
                answers({
                    PerplexityBot: answer(402, { 'crawler-price': 'USD 0.01' }),
                    Applebot: answer(402),
                }),
                [],
            ).map(({ check }) => check),
        ).toEqual(['ai-cdn-blocked', 'pay-per-crawl']);

        expect(
            cdnFindings(
                home,
                answers({ Applebot: answer(500), PerplexityBot: answer(429) }),
                [],
            ),
        ).toEqual([]);
    });
});

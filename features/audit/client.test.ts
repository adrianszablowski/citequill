import { describe, expect, it } from 'vitest';

import {
    foreignAttempts,
    foreignClient,
    foreignIntervalMs,
    siteClient,
} from '@/features/audit/client';
import { attemptsPerUrl, firstPace } from '@/features/audit/pacing';
import { botSecretHeader, type FetchDeps } from '@/features/crawl/fetch';

function client(answers: (() => Response)[], deadline = Date.now() + 60_000) {
    const calls: string[] = [];
    const sent: RequestInit[] = [];

    const deps: FetchDeps = {
        fetch: async (input, init = {}) => {
            calls.push(String(input));
            sent.push(init);

            const answer = answers.shift();

            if (!answer) {
                throw new Error('No answer');
            }

            return answer();
        },
        lookup: async () => ['93.184.216.34'],
    };

    return {
        calls,
        sent,
        site: siteClient({
            botSecret: 's3cret',
            hosts: ['acme.com'],
            pace: firstPace,
            interval: 1,
            deadline,
            deps,
        }),
    };
}

const tooMany = () =>
    new Response('', { status: 429, headers: { 'retry-after': '0' } });

const ok = () => new Response('<h1>Acme</h1>', { status: 200 });

describe('siteClient', () => {
    it('waits out a 429 and asks again, then goes on', async () => {
        const { site, calls } = client([tooMany, ok]);

        const fetched = await site.read('https://acme.com/');

        expect(fetched).toMatchObject({ status: 200 });
        expect(calls).toHaveLength(2);

        expect(site.counts).toEqual({
            requests: 2,
            tooMany: 1,
            serverErrors: 0,
        });

        expect(site.pace().streak).toBe(0);
    });

    it('records the 429 after its last attempt and counts the streak', async () => {
        const { site } = client(
            Array.from({ length: attemptsPerUrl }, () => tooMany),
        );

        expect(await site.read('https://acme.com/')).toMatchObject({
            status: 429,
        });

        expect(site.pace().streak).toBe(attemptsPerUrl);
    });

    it('counts a request with no answer in the streak and returns the error', async () => {
        const { site } = client([]);

        expect(await site.read('https://acme.com/')).toBeInstanceOf(Error);
        expect(site.pace().streak).toBe(1);
    });

    it('leaves a URL unread when its turn comes after the step budget', async () => {
        const { site, calls } = client([ok], Date.now() - 1);

        expect(await site.read('https://acme.com/')).toBeNull();
        expect(calls).toEqual([]);
    });

    it('sends GET by default and HEAD when asked, with no body read', async () => {
        const { site, sent } = client([ok, ok]);

        expect(await site.read('https://acme.com/')).toMatchObject({
            body: '<h1>Acme</h1>',
        });

        expect(
            await site.read('https://acme.com/', { method: 'HEAD' }),
        ).toMatchObject({ status: 200, body: '' });

        expect(sent.map(({ method }) => method)).toEqual(['GET', 'HEAD']);
    });

    it("sends the bot secret to the site's own hosts and never to a foreign one", async () => {
        const { site, sent } = client([ok, ok]);

        await site.read('https://acme.com/');
        await site.read('https://staging.acme.com/');

        expect(
            sent.map((init) => new Headers(init.headers).get(botSecretHeader)),
        ).toEqual(['s3cret', null]);
    });
});

describe('foreignClient', () => {
    function abroad(
        answers: (() => Response)[],
        deadline = Date.now() + 60_000,
    ) {
        const calls: string[] = [];
        const sent: RequestInit[] = [];

        const deps: FetchDeps = {
            fetch: async (input, init = {}) => {
                calls.push(String(input));
                sent.push(init);

                const answer = answers.shift();

                if (!answer) {
                    throw new Error('No answer');
                }

                return answer();
            },
            lookup: async () => ['93.184.216.34'],
        };

        return {
            calls,
            sent,
            foreign: foreignClient({ interval: 1, deadline, deps }),
        };
    }

    it('records a 429 or a 403 as the answer, with no retry and no bot secret', async () => {
        const { foreign, calls, sent } = abroad([tooMany]);

        expect(
            await foreign.read('https://other.com/', { method: 'HEAD' }),
        ).toMatchObject({ status: 429 });

        expect(calls).toHaveLength(1);
        expect(new Headers(sent[0].headers).get(botSecretHeader)).toBeNull();
        expect(sent[0].method).toBe('HEAD');
        expect(foreign.counts.requests).toBe(1);
    });

    it(`asks again once after no answer, then returns the error`, async () => {
        const { foreign, calls } = abroad([]);

        expect(await foreign.read('https://other.com/')).toBeInstanceOf(Error);
        expect(calls).toHaveLength(foreignAttempts);

        const retried = abroad([
            () => {
                throw new Error('reset');
            },
            ok,
        ]);

        expect(await retried.foreign.read('https://other.com/')).toMatchObject({
            status: 200,
        });
    });

    it(`waits ${foreignIntervalMs} ms between two requests to one host, and none between two hosts`, async () => {
        const deadline = Date.now() + foreignIntervalMs / 2;

        const deps: FetchDeps = {
            fetch: async () => ok(),
            lookup: async () => ['93.184.216.34'],
        };

        const foreign = foreignClient({ deadline, deps });

        expect(await foreign.read('https://other.com/a')).toMatchObject({
            status: 200,
        });

        expect(await foreign.read('https://else.net/b')).toMatchObject({
            status: 200,
        });

        expect(await foreign.read('https://other.com/c')).toBeNull();
        expect(foreign.counts.requests).toBe(2);
    });

    it("takes a turn of the hop's host for a redirect to another host", async () => {
        const deadline = Date.now() + foreignIntervalMs / 2;

        const answers = [
            () =>
                new Response(null, {
                    status: 301,
                    headers: { location: 'https://else.net/b' },
                }),
            ok,
        ];

        const deps: FetchDeps = {
            fetch: async () => answers.shift()!(),
            lookup: async () => ['93.184.216.34'],
        };

        const foreign = foreignClient({ deadline, deps });

        expect(await foreign.read('https://other.com/a')).toMatchObject({
            status: 200,
            url: 'https://else.net/b',
        });

        expect(foreign.counts.requests).toBe(2);
        expect(await foreign.read('https://else.net/c')).toBeNull();
        expect(foreign.counts.requests).toBe(2);
    });
});

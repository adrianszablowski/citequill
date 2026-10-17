import { describe, expect, it } from 'vitest';

import { siteClient } from '@/features/audit/client';
import { attemptsPerUrl, firstPace } from '@/features/audit/pacing';
import type { FetchDeps } from '@/features/crawl/fetch';

function client(answers: (() => Response)[], deadline = Date.now() + 60_000) {
    const calls: string[] = [];

    const deps: FetchDeps = {
        fetch: async (input) => {
            calls.push(String(input));

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
});

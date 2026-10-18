import { setTimeout as sleep } from 'node:timers/promises';

import {
    afterAnswer,
    attemptsPerUrl,
    firstPace as unpaced,
    isRateLimit,
    type Pace,
    requestIntervalMs,
    takeSlot,
} from '@/features/audit/pacing';
import {
    defaultDeps,
    type Fetched,
    type FetchDeps,
    type FetchOptions,
    fetchPublic,
    tlsErrorOf,
} from '@/features/crawl/fetch';

export interface SiteRequests {
    requests: number;
    tooMany: number;
    serverErrors: number;
}

export type SiteClient = ReturnType<typeof siteClient>;

export type ForeignClient = ReturnType<typeof foreignClient>;

export const foreignIntervalMs = 500;

export const foreignAttempts = 2;

export interface ClientOptions {
    botSecret: string;
    hosts: string[];
    pace: Pace;
    interval?: number;
    deadline: number;
    deps?: FetchDeps;
}

export function siteClient({
    botSecret,
    hosts,
    pace: firstPace,
    interval = requestIntervalMs,
    deadline,
    deps = defaultDeps,
}: ClientOptions) {
    let pace = firstPace;
    const counts: SiteRequests = { requests: 0, tooMany: 0, serverErrors: 0 };

    function pacedDeps(): FetchDeps {
        let isFirstHop = true;

        return {
            ...deps,
            fetch: async (input, init) => {
                if (!isFirstHop) {
                    pace = takeSlot(pace, interval, Date.now()).pace;
                }

                isFirstHop = false;
                counts.requests += 1;

                const response = await deps.fetch(input, init);

                counts.tooMany += Number(response.status === 429);
                counts.serverErrors += Number(response.status >= 500);

                pace = afterAnswer(
                    pace,
                    response.status,
                    response.headers.get('retry-after'),
                    interval,
                    Date.now(),
                );

                return response;
            },
        };
    }

    async function read(
        url: string,
        {
            method = 'GET',
            headers,
        }: Pick<FetchOptions, 'method' | 'headers'> = {},
    ): Promise<Fetched | Error | null> {
        for (let attempt = 1; ; attempt += 1) {
            const slot = takeSlot(pace, interval, Date.now());

            if (slot.at > deadline) {
                return null;
            }

            pace = slot.pace;
            await sleep(slot.at - Date.now());

            try {
                const fetched = await fetchPublic(url, pacedDeps(), {
                    method,
                    headers,
                    botSecret: { value: botSecret, hosts },
                });

                if (!isRateLimit(fetched.status) || attempt >= attemptsPerUrl) {
                    return fetched;
                }
            } catch (error) {
                if (tlsErrorOf(error) === null) {
                    pace = afterAnswer(pace, null, null, interval, Date.now());
                }

                return error instanceof Error
                    ? error
                    : new Error(String(error));
            }
        }
    }

    return { read, counts, pace: () => pace };
}

export function foreignClient({
    interval = foreignIntervalMs,
    deadline,
    deps = defaultDeps,
}: Pick<ClientOptions, 'interval' | 'deadline' | 'deps'>) {
    const paces = new Map<string, Pace>();
    const counts = { requests: 0 };

    function slotOf(host: string) {
        return takeSlot(paces.get(host) ?? unpaced, interval, Date.now());
    }

    function pacedDeps(): FetchDeps {
        let isFirstHop = true;

        return {
            ...deps,
            fetch: async (input, init) => {
                if (!isFirstHop) {
                    const { hostname } = new URL(String(input));

                    paces.set(hostname, slotOf(hostname).pace);
                }

                isFirstHop = false;
                counts.requests += 1;

                return deps.fetch(input, init);
            },
        };
    }

    async function read(
        url: string,
        { method = 'GET' }: Pick<FetchOptions, 'method'> = {},
    ): Promise<Fetched | Error | null> {
        const host = new URL(url).hostname;

        for (let attempt = 1; ; attempt += 1) {
            const slot = slotOf(host);

            if (slot.at > deadline) {
                return null;
            }

            paces.set(host, slot.pace);
            await sleep(slot.at - Date.now());

            try {
                return await fetchPublic(url, pacedDeps(), { method });
            } catch (error) {
                if (attempt >= foreignAttempts) {
                    return error instanceof Error
                        ? error
                        : new Error(String(error));
                }
            }
        }
    }

    return { read, counts };
}

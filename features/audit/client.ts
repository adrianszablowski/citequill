import { setTimeout as sleep } from 'node:timers/promises';

import {
    afterAnswer,
    attemptsPerUrl,
    isRateLimit,
    type Pace,
    requestIntervalMs,
    takeSlot,
} from '@/features/audit/pacing';
import {
    defaultDeps,
    type Fetched,
    type FetchDeps,
    fetchPublic,
} from '@/features/crawl/fetch';

export interface SiteRequests {
    requests: number;
    tooMany: number;
    serverErrors: number;
}

export type SiteClient = ReturnType<typeof siteClient>;

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

    async function read(url: string): Promise<Fetched | Error | null> {
        for (let attempt = 1; ; attempt += 1) {
            const slot = takeSlot(pace, interval, Date.now());

            if (slot.at > deadline) {
                return null;
            }

            pace = slot.pace;
            await sleep(slot.at - Date.now());

            try {
                const fetched = await fetchPublic(url, pacedDeps(), {
                    botSecret: { value: botSecret, hosts },
                });

                if (!isRateLimit(fetched.status) || attempt >= attemptsPerUrl) {
                    return fetched;
                }
            } catch (error) {
                pace = afterAnswer(pace, null, null, interval, Date.now());

                return error instanceof Error
                    ? error
                    : new Error(String(error));
            }
        }
    }

    return { read, counts, pace: () => pace };
}

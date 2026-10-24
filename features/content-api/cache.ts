import { revalidateTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';

export const apiCacheLife = { revalidate: 5 * 60, expire: 15 * 60 };

export function apiCacheTag(projectId: string) {
    return `content-api-${projectId}`;
}

export function clearApiCache(projectId: string) {
    revalidateTag(apiCacheTag(projectId), { expire: 0 });
}

export function orUncached<Args extends unknown[], Result>(
    cached: (...args: Args) => Promise<Result>,
    uncached: (...args: Args) => Promise<Result>,
) {
    return async (...args: Args) => {
        try {
            return await cached(...args);
        } catch (cause) {
            unstable_rethrow(cause);

            console.error(
                'A cached read of the Content API failed, so it ran again without the cache.',
                cause,
            );

            return uncached(...args);
        }
    };
}

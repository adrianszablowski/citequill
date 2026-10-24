import { revalidateTag } from 'next/cache';
import { describe, expect, it, vi } from 'vitest';

import {
    apiCacheTag,
    clearApiCache,
    orUncached,
} from '@/features/content-api/cache';

vi.mock('next/cache', () => {
    return { revalidateTag: vi.fn() };
});

describe('clearApiCache', () => {
    it("expires the project's tag at once, so no stale answer is served again", () => {
        clearApiCache('project');

        expect(revalidateTag).toHaveBeenCalledWith('content-api-project', {
            expire: 0,
        });

        expect(apiCacheTag('project')).toBe('content-api-project');
    });
});

describe('orUncached', () => {
    it('answers from the cache and never reads past it when the cache answers', async () => {
        const uncached = vi.fn(async (id: string) => `fresh ${id}`);
        const read = orUncached(async (id: string) => `cached ${id}`, uncached);

        expect(await read('page')).toBe('cached page');
        expect(uncached).not.toHaveBeenCalled();
    });

    it('logs a failed cached read and runs it again without the cache, with the same arguments', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});

        const read = orUncached<[string, number], string>(
            async () => {
                throw new Error('Runtime Cache did not answer');
            },
            async (id, limit) => `fresh ${id} ${limit}`,
        );

        expect(await read('page', 20)).toBe('fresh page 20');
        expect(log).toHaveBeenCalledOnce();
    });

    it('lets the error through when the read fails without the cache too', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const read = orUncached(
            async () => {
                throw new Error('Runtime Cache did not answer');
            },
            async () => {
                throw new Error('connection reset');
            },
        );

        await expect(read()).rejects.toThrow('connection reset');
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { start } from 'workflow/api';

import { startAfterPublish } from '@/features/publishing/after-publish';
import { afterPublish } from '@/features/publishing/workflow';

vi.mock('server-only', () => {
    return {};
});

vi.mock('workflow/api', () => {
    return { start: vi.fn() };
});

vi.mock('@/features/content-api/cache', () => {
    return { apiCacheLife: { revalidate: 60, expire: 30 * 60 } };
});

vi.mock('@/features/publishing/workflow', () => {
    return { afterPublish: vi.fn() };
});

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('startAfterPublish', () => {
    it('starts the run for the project and has nothing to say', async () => {
        expect(await startAfterPublish('project', 'publish')).toBeNull();
        expect(start).toHaveBeenCalledWith(afterPublish, ['project']);
    });

    it('says the action stands when the run does not start', async () => {
        vi.mocked(start).mockRejectedValue(new Error('queue down'));

        expect(await startAfterPublish('project', 'publish')).toMatch(
            /^The page is live\./,
        );

        expect(await startAfterPublish('project', 'unpublish')).toMatch(
            /^The page is unpublished\./,
        );

        expect(await startAfterPublish('project', 'settings')).toMatch(
            /^The change is saved\./,
        );
    });

    it("bounds the old version's life by the cache's lifetime", async () => {
        vi.mocked(start).mockRejectedValue(new Error('queue down'));

        for (const action of ['publish', 'unpublish', 'settings'] as const) {
            expect(await startAfterPublish('project', action)).toContain(
                'for up to 30 minutes.',
            );
        }
    });
});

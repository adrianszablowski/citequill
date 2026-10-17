import { refresh } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentUser } from '@/features/auth/queries';
import { regenerateBotSecret } from '@/features/projects/actions';
import { fakeSupabase } from '@/lib/supabase/fake';
import { createClient } from '@/lib/supabase/server';

vi.mock('next/cache', () => {
    return { refresh: vi.fn() };
});

vi.mock('@/features/auth/queries', () => {
    return { getCurrentUser: vi.fn() };
});

vi.mock('@/features/crawl/actions', () => {
    return { startCrawl: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => {
    return { createClient: vi.fn() };
});

function database(answer: object) {
    const fake = fakeSupabase(() => answer);

    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    return fake;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('regenerateBotSecret', () => {
    it("writes a new 32-byte hex secret to the owner's project and refreshes the page", async () => {
        const fake = database({ data: [{ id: 'project' }] });

        await regenerateBotSecret('project');

        expect(getCurrentUser).toHaveBeenCalled();
        expect(fake.writes()).toEqual(['update projects']);

        const [update, ...filters] = fake.queries[0].calls;

        expect(update).toEqual([
            'update',
            { bot_secret: expect.stringMatching(/^[0-9a-f]{64}$/) },
        ]);

        expect(filters).toEqual([
            ['eq', 'id', 'project'],
            ['select', 'id'],
        ]);

        expect(refresh).toHaveBeenCalled();
    });

    it('writes a different secret each time', async () => {
        const fake = database({ data: [{ id: 'project' }] });

        await regenerateBotSecret('project');
        await regenerateBotSecret('project');

        const [first, second] = fake.queries.map(
            ({ calls }) => (calls[0][1] as { bot_secret: string }).bot_secret,
        );

        expect(first).not.toBe(second);
    });

    it('throws when the update is refused and refreshes nothing', async () => {
        database({ error: { message: 'permission denied' } });

        await expect(regenerateBotSecret('project')).rejects.toThrow(
            'permission denied',
        );

        expect(refresh).not.toHaveBeenCalled();
    });

    it('throws on a project the user does not own, because the update changes no row', async () => {
        database({ data: [] });

        await expect(regenerateBotSecret('project')).rejects.toThrow();
        expect(refresh).not.toHaveBeenCalled();
    });
});

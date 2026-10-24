import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startAfterPublish } from '@/features/publishing/after-publish';
import { saveLogo, touchLivePages } from '@/features/publishing/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { fakeSupabase } from '@/lib/supabase/fake';

vi.mock('server-only', () => {
    return {};
});

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

vi.mock('@/features/publishing/after-publish', () => {
    return { startAfterPublish: vi.fn(async () => null) };
});

function database(answer: object = {}) {
    const fake = fakeSupabase(() => answer);

    vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

    return fake;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('saveLogo', () => {
    it("writes the logo's address with the size its check read, as the server", async () => {
        const fake = database();

        await saveLogo('project', {
            url: 'https://acme.com/logo.png',
            width: 600,
            height: 100,
        });

        expect(fake.queries[0].calls).toEqual([
            [
                'update',
                {
                    organization_logo_url: 'https://acme.com/logo.png',
                    organization_logo_width: 600,
                    organization_logo_height: 100,
                },
            ],
            ['eq', 'id', 'project'],
        ]);
    });

    it('clears all three columns for no logo, and throws when the write fails', async () => {
        const fake = database();

        await saveLogo('project', null);

        expect(fake.queries[0].calls[0]).toEqual([
            'update',
            {
                organization_logo_url: null,
                organization_logo_width: null,
                organization_logo_height: null,
            },
        ]);

        database({ error: { message: 'permission denied' } });

        await expect(saveLogo('project', null)).rejects.toThrow(
            'permission denied',
        );
    });
});

describe('touchLivePages', () => {
    it('moves every live page of the project, or the pages that name an author', async () => {
        const fake = database({ data: [] });

        await touchLivePages('project');
        await touchLivePages('project', 'author');

        expect(fake.queries.map(({ name, calls }) => [name, calls])).toEqual([
            [
                'touch_live_pages',
                [['rpc', { project: 'project', author: undefined }]],
            ],
            [
                'touch_live_pages',
                [['rpc', { project: 'project', author: 'author' }]],
            ],
        ]);
    });

    it('starts the after-publish run when it moved a page, and passes on what it says', async () => {
        database({ data: [{ id: 'page' }] });

        vi.mocked(startAfterPublish).mockResolvedValueOnce(
            'The change is saved.',
        );

        expect(await touchLivePages('project')).toBe('The change is saved.');
        expect(startAfterPublish).toHaveBeenCalledWith('project', 'settings');
    });

    it('starts no run when no live page shows the change', async () => {
        database({ data: [] });

        expect(await touchLivePages('project', 'author')).toBeNull();
        expect(startAfterPublish).not.toHaveBeenCalled();
    });
});

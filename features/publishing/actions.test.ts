import { refresh } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { publishPage, unpublishPage } from '@/features/publishing/actions';
import { publish, unpublish } from '@/features/publishing/publish';
import { fakeSupabase } from '@/lib/supabase/fake';
import { createClient } from '@/lib/supabase/server';

vi.mock('next/cache', () => {
    return { refresh: vi.fn() };
});

vi.mock('@/features/auth/queries', () => {
    return { getCurrentUser: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => {
    return { createClient: vi.fn() };
});

vi.mock('@/features/publishing/publish', () => {
    return {
        publish: vi.fn(async () => ({ pages: [], updated: [] })),
        unpublish: vi.fn(async () => ({ pages: [], updated: [] })),
    };
});

function session(page: object | null) {
    const fake = fakeSupabase(() => ({ data: page }));

    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    return fake;
}

const live = {
    id: 'page',
    published_pages: { url: 'https://acme.com/pl/blog/deload' },
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('publishPage', () => {
    it("reads the page through the owner's session, then publishes it and refreshes", async () => {
        const fake = session(live);

        expect(await publishPage('project', 'page')).toEqual({
            pages: [],
            updated: [],
        });

        expect(fake.queries[0].calls).toContainEqual(['eq', 'id', 'page']);
        expect(fake.writes()).toEqual([]);
        expect(publish).toHaveBeenCalledWith('project', ['page']);
        expect(refresh).toHaveBeenCalled();
    });

    it('publishes nothing on a page the session cannot read', async () => {
        session(null);

        expect(await publishPage('project', 'page')).toEqual({
            error: 'The page is gone from this project.',
        });

        expect(publish).not.toHaveBeenCalled();
    });

    it('keeps the page on screen with the sentence when publishing refuses', async () => {
        session(live);
        vi.mocked(publish).mockResolvedValueOnce({ error: 'No author.' });

        expect(await publishPage('project', 'page')).toEqual({
            error: 'No author.',
        });

        expect(refresh).not.toHaveBeenCalled();
    });
});

describe('unpublishPage', () => {
    it("redirects to a path as an absolute URL on the page's host", async () => {
        session(live);

        await unpublishPage('project', 'page', {
            answer: 'redirect',
            to: '/pricing',
        });

        expect(unpublish).toHaveBeenCalledWith(
            'project',
            'page',
            'https://acme.com/pricing',
        );
    });

    it('answers 410 with no redirect, whatever the address field holds', async () => {
        session(live);

        await unpublishPage('project', 'page', {
            answer: 'gone',
            to: '/pricing',
        });

        expect(unpublish).toHaveBeenCalledWith('project', 'page', null);
        expect(refresh).toHaveBeenCalled();
    });

    it('refuses values that do not parse', async () => {
        session(live);

        expect(
            await unpublishPage('project', 'page', {
                answer: 'moved',
                to: '',
            } as never),
        ).toEqual({ error: 'Check where the address sends visitors.' });

        expect(unpublish).not.toHaveBeenCalled();
    });

    it("refuses a redirect to the page's own address, which would loop", async () => {
        session(live);

        for (const to of ['/pl/blog/deload/', live.published_pages.url]) {
            expect(
                await unpublishPage('project', 'page', {
                    answer: 'redirect',
                    to,
                }),
            ).toEqual({
                error: "The redirect points at the page's own address. Give another one.",
            });
        }

        expect(unpublish).not.toHaveBeenCalled();
    });

    it('unpublishes nothing for an address that leaves the site as a path, or a page that is not live', async () => {
        session(live);

        expect(
            await unpublishPage('project', 'page', {
                answer: 'redirect',
                to: '//evil.com',
            }),
        ).toHaveProperty('error');

        session({ id: 'page', published_pages: null });

        expect(
            await unpublishPage('project', 'page', { answer: 'gone', to: '' }),
        ).toEqual({
            error: 'The page is not live, so there is nothing to unpublish.',
        });

        expect(unpublish).not.toHaveBeenCalled();
    });
});

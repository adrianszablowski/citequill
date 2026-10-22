import { refresh } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    discardChanges,
    startWrite,
    updatePage,
} from '@/features/pages/actions';
import type { PageValues } from '@/features/pages/schema';
import { fakeSupabase, type FakeQuery } from '@/lib/supabase/fake';
import { createClient } from '@/lib/supabase/server';

vi.mock('next/cache', () => {
    return { refresh: vi.fn() };
});

vi.mock('workflow/api', () => {
    return { start: vi.fn() };
});

vi.mock('@/features/pages/workflow', () => {
    return { writePage: vi.fn() };
});

vi.mock('@/features/auth/queries', () => {
    return { getCurrentUser: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => {
    return { createClient: vi.fn() };
});

function session(answer: (query: FakeQuery) => object) {
    const fake = fakeSupabase(answer);

    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    return fake;
}

const values: PageValues = {
    title: 'Deload week',
    slug: 'deload-week',
    meta_title: 'Deload week, explained',
    meta_description: 'What a deload week is and when to take one.',
    excerpt: 'A week of lighter training.',
    body_md: 'Rest.',
    faq: [{ question: 'How long?', answer: 'A week.' }],
    sources: [{ title: 'A study', url: 'https://example.org/study' }],
    tags: ['recovery'],
    author_id: 'author',
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('startWrite', () => {
    it('stores the run with the language in its canonical form', async () => {
        const fake = session(({ name }) =>
            name === 'page_kinds'
                ? { data: { id: 'kind' } }
                : { data: { id: 'run' } },
        );

        expect(
            await startWrite('project', {
                topic: 'How to deload',
                kind_id: 'kind',
                locale: 'en-us',
            }),
        ).toEqual({ runId: 'run' });

        expect(
            fake.queries.find(({ name }) => name === 'runs')?.calls[0],
        ).toEqual([
            'insert',
            {
                project_id: 'project',
                trigger: 'manual',
                topic: 'How to deload',
                kind_id: 'kind',
                locale: 'en-US',
            },
        ]);
    });
});

describe('updatePage', () => {
    function database(authors: object | null = { id: 'author' }) {
        return session(({ name }) => {
            if (name === 'pages') {
                return { data: { project_id: 'project' } };
            }

            return { data: authors };
        });
    }

    it("writes only the fields the editor holds, and leaves updated_at and content_hash to the database's trigger", async () => {
        const fake = database();

        expect(await updatePage('page', values)).toEqual({ values });

        expect(
            fake.queries.find(({ calls }) => calls[0][0] === 'update')
                ?.calls[0],
        ).toEqual(['update', values]);
    });

    it("takes an author only from the page's own project", async () => {
        const fake = database();

        await updatePage('page', values);

        expect(
            fake.queries.find(({ name }) => name === 'authors')?.calls,
        ).toEqual(
            expect.arrayContaining([
                ['eq', 'id', 'author'],
                ['eq', 'project_id', 'project'],
            ]),
        );
    });

    it('refuses an author of another project, and writes nothing', async () => {
        const fake = database(null);

        expect(await updatePage('page', values)).toEqual({
            error: "Pick one of this project's authors.",
        });

        expect(fake.writes()).toEqual([]);
    });

    it('says the same when the database refuses the author', async () => {
        session(({ name, calls }) => {
            if (calls[0]?.[0] === 'update') {
                return { error: { code: '23503', message: 'foreign key' } };
            }

            return {
                data:
                    name === 'pages' ? { project_id: 'project' } : { id: 'a' },
            };
        });

        expect(await updatePage('page', values)).toEqual({
            error: "Pick one of this project's authors.",
        });
    });

    it('needs no author check for a page with no author', async () => {
        const fake = session(() => ({}));

        expect(
            await updatePage('page', { ...values, author_id: null }),
        ).toEqual({ values: { ...values, author_id: null } });

        expect(fake.queries.map(({ name }) => name)).toEqual(['pages']);
    });

    it('says so when another page of the language has the slug', async () => {
        session(({ calls }) =>
            calls[0]?.[0] === 'update'
                ? { error: { code: '23505', message: 'duplicate' } }
                : { data: { project_id: 'project', id: 'author' } },
        );

        expect(await updatePage('page', values)).toEqual({
            error: 'Another page in this language has this slug. Pick another one.',
        });
    });
});

describe('discardChanges', () => {
    const live = {
        title: 'Deload week',
        meta_title: 'Deload week, explained',
        meta_description: 'What a deload week is.',
        excerpt: 'A week of lighter training.',
        body_md: 'Rest.',
        faq: [],
        sources: [],
        tags: [],
        author_id: 'kind-author',
    };

    function database(version: object | null = live, update: object = {}) {
        return session(({ name }) =>
            name === 'published_pages' ? { data: version } : update,
        );
    }

    it("copies the published version's fields back into the copy in one update, never the slug", async () => {
        const fake = database();

        expect(await discardChanges('project', 'page')).toEqual({
            values: live,
        });

        expect(fake.writes()).toEqual(['update pages']);
        expect(fake.queries[1].calls[0]).toEqual(['update', live]);
        expect(fake.queries[1].calls[0][1]).not.toHaveProperty('slug');
        expect(refresh).toHaveBeenCalled();
    });

    it('fails without a refresh when the update fails', async () => {
        database(live, { error: { message: 'permission denied' } });

        await expect(discardChanges('project', 'page')).rejects.toThrow(
            'permission denied',
        );

        expect(refresh).not.toHaveBeenCalled();
    });

    it('writes nothing for a page with no published version the session can read', async () => {
        const fake = database(null);

        expect(await discardChanges('project', 'page')).toEqual({
            error: 'The page has no live version to go back to.',
        });

        expect(fake.writes()).toEqual([]);
    });
});

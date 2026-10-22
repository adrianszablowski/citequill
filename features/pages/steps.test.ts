import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadWriteContext } from '@/features/pages/steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { fakeSupabase } from '@/lib/supabase/fake';

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

vi.mock('@/features/runs/steps', () => {
    return { addUsage: vi.fn(), markProgress: vi.fn() };
});

const tables: Record<string, object> = {
    runs: { topic: 'Deload week', kind_id: 'kind', locale: 'pl' },
    projects: { name: 'Acme' },
    skills: [],
    page_kinds: [
        {
            id: 'kind',
            name: 'Blog',
            url_prefix: '/blog',
            skill_id: null,
            author_id: 'author',
            skills: null,
        },
    ],
    project_locales: [
        { locale: 'pl', base_url: 'https://acme.com/pl', is_default: true },
    ],
    crawled_pages: [{ url: 'https://acme.com/pl/pricing', title: 'Cennik' }],
    published_pages: [
        {
            url: 'https://acme.com/pl/blog/protein',
            title: 'Protein',
            pages: { status: 'published' },
        },
    ],
};

function database() {
    const fake = fakeSupabase(({ name }) => ({ data: tables[name] }));

    vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

    return fake;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('loadWriteContext', () => {
    it('offers the writer the crawled pages and the live pages at the URL they went live at', async () => {
        const fake = database();

        const target = await loadWriteContext('project', 'run');

        expect(target.context.sitePages).toEqual([
            { url: 'https://acme.com/pl/pricing', title: 'Cennik' },
            { url: 'https://acme.com/pl/blog/protein', title: 'Protein' },
        ]);

        expect(
            fake.queries.find(({ name }) => name === 'published_pages')?.calls,
        ).toEqual(
            expect.arrayContaining([
                ['eq', 'project_id', 'project'],
                ['eq', 'pages.status', 'published'],
            ]),
        );
    });

    it("gives the draft its kind's author", async () => {
        database();

        expect(await loadWriteContext('project', 'run')).toMatchObject({
            kindId: 'kind',
            authorId: 'author',
        });
    });
});

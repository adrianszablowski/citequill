import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderMarkdown } from '@/features/pages/render';
import { publish, unpublish } from '@/features/publishing/publish';
import { createAdminClient } from '@/lib/supabase/admin';
import { fakeSupabase } from '@/lib/supabase/fake';

vi.mock('server-only', () => {
    return {};
});

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

const body = '# Deload\n\nRest a week.[^1]\n\n[^1]: A study.';

const page = {
    id: 'page',
    locale: 'pl',
    slug: 'deload',
    body_md: body,
    content_hash: 'hash-of-the-copy',
    author_id: 'author',
    page_kinds: { url_prefix: '/blog', author_id: null },
    published_pages: null,
};

const published = {
    pages: [
        {
            id: 'page',
            locale: 'pl',
            slug: 'deload',
            path: '/pl/blog/deload',
            url: 'https://acme.com/pl/blog/deload',
            was_live: false,
            body_changed: true,
        },
    ],
    updated: [
        {
            id: 'sibling',
            locale: 'en',
            slug: 'deload',
            path: '/blog/deload',
            url: 'https://acme.com/blog/deload',
        },
    ],
};

function database({
    pages = [page] as object[],
    rpc = { data: published } as object,
} = {}) {
    const fake = fakeSupabase(({ name }) => {
        if (name === 'pages') {
            return { data: pages };
        }

        if (name === 'project_locales') {
            return {
                data: [{ locale: 'pl', base_url: 'https://acme.com/pl' }],
            };
        }

        return rpc;
    });

    vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

    return fake;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('publish', () => {
    it('sends publish_pages the version it rendered from the copy it read', async () => {
        const fake = database();

        await publish('project', ['page']);

        const { html, toc, wordCount } = renderMarkdown(body, 'pl');

        expect(fake.writes()).toEqual(['rpc publish_pages']);

        expect(
            fake.queries.find(({ name }) => name === 'publish_pages')!.calls[0],
        ).toEqual([
            'rpc',
            {
                project: 'project',
                versions: [
                    {
                        page_id: 'page',
                        content_hash: 'hash-of-the-copy',
                        path: '/pl/blog/deload',
                        url: 'https://acme.com/pl/blog/deload',
                        body_html: html,
                        toc,
                        word_count: wordCount,
                        body_hash: createHash('sha256')
                            .update(html)
                            .digest('hex'),
                        reading_minutes: 1,
                    },
                ],
            },
        ]);

        expect(html).toContain('Przypisy');
    });

    it('returns the pages of the action and the live versions whose alternates changed', async () => {
        database();

        expect(await publish('project', ['page'])).toEqual(published);
    });

    it('writes nothing when the check refuses the page', async () => {
        const fake = database({ pages: [{ ...page, author_id: null }] });

        expect(await publish('project', ['page'])).toEqual({
            error: "Pick the page's author in Edit, then publish it.",
        });

        expect(fake.writes()).toEqual([]);
    });

    it('writes nothing when a page of the action is not in the project', async () => {
        const fake = database({ pages: [] });

        expect(await publish('project', ['page'])).toEqual({
            error: 'The page is gone from this project.',
        });

        expect(fake.writes()).toEqual([]);
    });

    it.each([
        [
            'The page changed since it was rendered.',
            'The page was saved while it was being published, so it did not go out. Publish it again.',
        ],
        [
            "The page's path moved since it was published.",
            "The page's address changed while it was being published. Open the page again to see what moved.",
        ],
        [
            'The page has no author.',
            "The page lost its author while it was being published. Pick the page's author in Edit, then publish it.",
        ],
        ['permission denied', 'Publishing did not finish. Try again.'],
    ])(
        'turns the refusal "%s" into a sentence for the owner',
        async (message, sentence) => {
            database({ rpc: { error: { message } } });

            expect(await publish('project', ['page'])).toEqual({
                error: sentence,
            });
        },
    );
});

describe('unpublish', () => {
    const removed = {
        pages: [
            {
                id: 'page',
                locale: 'pl',
                slug: 'deload',
                path: '/pl/blog/deload',
                url: 'https://acme.com/pl/blog/deload',
                redirect: null,
            },
        ],
        updated: [],
    };

    it('sends unpublish_page no redirect for a 410, and returns what it touched', async () => {
        const fake = database({ rpc: { data: removed } });

        expect(await unpublish('project', 'page', null)).toEqual(removed);

        expect(fake.queries[0]).toEqual({
            name: 'unpublish_page',
            calls: [['rpc', { project: 'project', page: 'page' }]],
        });
    });

    it('says so when the page is not live', async () => {
        database({
            rpc: {
                error: { message: 'The page is not live in this project.' },
            },
        });

        expect(await unpublish('project', 'page', null)).toEqual({
            error: 'The page is not live, so there is nothing to unpublish.',
        });
    });
});

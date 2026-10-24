import { refresh } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentUser } from '@/features/auth/queries';
import {
    createAuthor,
    deleteAuthor,
    regenerateBotSecret,
    updateAuthor,
    updateKindAuthors,
    updateOrganization,
} from '@/features/projects/actions';
import { checkLogo } from '@/features/publishing/logo';
import { saveLogo, touchLivePages } from '@/features/publishing/settings';
import { fakeSupabase, type FakeQuery } from '@/lib/supabase/fake';
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

vi.mock('@/features/publishing/logo', () => {
    return { checkLogo: vi.fn() };
});

vi.mock('@/features/publishing/settings', () => {
    return { saveLogo: vi.fn(), touchLivePages: vi.fn(async () => null) };
});

function database(answer: object) {
    return session(() => answer);
}

function session(answer: (query: FakeQuery) => object) {
    const fake = fakeSupabase(answer);

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

describe('updateOrganization', () => {
    const values = {
        name: ' Acme Inc. ',
        url: 'https://acme.com',
        logo_url: 'https://acme.com/logo.png',
        same_as:
            'https://x.com/acme\n\n https://www.linkedin.com/company/acme \n',
    };

    const logo = { url: 'https://acme.com/logo.png', width: 600, height: 100 };

    const stored = {
        organization_name: 'Acme Inc.',
        organization_url: 'https://acme.com',
        organization_same_as: [
            'https://x.com/acme',
            'https://www.linkedin.com/company/acme',
        ],
        organization_logo_url: logo.url,
        organization_logo_width: logo.width,
        organization_logo_height: logo.height,
    };

    function project(row: object = {}) {
        return session(({ calls }) =>
            calls[0][0] === 'select' ? { data: { ...stored, ...row } } : {},
        );
    }

    function written(fake: ReturnType<typeof fakeSupabase>) {
        return fake.queries.find(({ calls }) => calls[0][0] === 'update')
            ?.calls;
    }

    it("writes the owner's columns in the session and moves every live page", async () => {
        const fake = project({ organization_name: 'Acme' });

        vi.mocked(checkLogo).mockResolvedValue({ logo });

        expect(await updateOrganization('project', values)).toEqual({
            values: {
                name: 'Acme Inc.',
                url: 'https://acme.com',
                logo_url: 'https://acme.com/logo.png',
                same_as:
                    'https://x.com/acme\nhttps://www.linkedin.com/company/acme',
            },
            warning: null,
            notice: null,
        });

        expect(written(fake)).toEqual([
            [
                'update',
                {
                    organization_name: 'Acme Inc.',
                    organization_url: 'https://acme.com',
                    organization_same_as: [
                        'https://x.com/acme',
                        'https://www.linkedin.com/company/acme',
                    ],
                },
            ],
            ['eq', 'id', 'project'],
        ]);

        expect(saveLogo).not.toHaveBeenCalled();
        expect(touchLivePages).toHaveBeenCalledWith('project');
        expect(refresh).toHaveBeenCalled();
    });

    it('checks the stored logo again on every save, and moves no page when nothing changed', async () => {
        const fake = project();

        vi.mocked(checkLogo).mockResolvedValue({ logo });

        await updateOrganization('project', values);

        expect(checkLogo).toHaveBeenCalledWith('https://acme.com/logo.png');
        expect(fake.writes()).toEqual([]);
        expect(saveLogo).not.toHaveBeenCalled();
        expect(touchLivePages).not.toHaveBeenCalled();
    });

    it('stores the new size of a logo whose file changed at the same address', async () => {
        project();

        const larger = { ...logo, width: 1200, height: 200 };

        vi.mocked(checkLogo).mockResolvedValue({ logo: larger });

        await updateOrganization('project', values);

        expect(saveLogo).toHaveBeenCalledWith('project', larger);
        expect(touchLivePages).toHaveBeenCalledWith('project');
    });

    it('checks a new logo and saves it with its size through the publishing module', async () => {
        project({
            organization_logo_url: null,
            organization_logo_width: null,
            organization_logo_height: null,
        });

        vi.mocked(checkLogo).mockResolvedValue({ logo });

        await updateOrganization('project', values);

        expect(saveLogo).toHaveBeenCalledWith('project', logo);
        expect(touchLivePages).toHaveBeenCalledWith('project');
    });

    it('saves nothing when a new logo fails its check, and gives the reason for the field', async () => {
        const fake = project({ organization_logo_url: null });

        vi.mocked(checkLogo).mockResolvedValue({ error: 'Not an image.' });

        expect(
            await updateOrganization('project', {
                ...values,
                name: 'Acme',
            }),
        ).toEqual({
            error: 'Not an image.',
            field: 'logo_url',
        });

        expect(fake.writes()).toEqual([]);
        expect(saveLogo).not.toHaveBeenCalled();
        expect(touchLivePages).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
    });

    it('keeps the stored logo and its size when its check fails, saves the rest and gives the reason as a warning', async () => {
        const fake = project();

        vi.mocked(checkLogo).mockResolvedValue({ error: 'Not an image.' });

        const result = await updateOrganization('project', {
            ...values,
            name: 'Acme',
        });

        expect(result).toMatchObject({ warning: 'Not an image.' });
        expect(fake.writes()).toEqual(['update projects']);
        expect(saveLogo).not.toHaveBeenCalled();
        expect(touchLivePages).toHaveBeenCalledWith('project');
    });

    it('clears the logo, its width and its height when the address is emptied', async () => {
        project();

        await updateOrganization('project', { ...values, logo_url: '' });

        expect(checkLogo).not.toHaveBeenCalled();
        expect(saveLogo).toHaveBeenCalledWith('project', null);
        expect(touchLivePages).toHaveBeenCalledWith('project');
    });

    it('stores an empty name or URL as empty, so the defaults apply', async () => {
        const fake = project();

        await updateOrganization('project', {
            name: '  ',
            url: '',
            logo_url: '',
            same_as: '',
        });

        expect(written(fake)?.[0]).toEqual([
            'update',
            {
                organization_name: null,
                organization_url: null,
                organization_same_as: [],
            },
        ]);
    });

    it('throws and moves no page when the logo cannot be written', async () => {
        project({ organization_logo_url: null });

        vi.mocked(checkLogo).mockResolvedValue({ logo });
        vi.mocked(saveLogo).mockRejectedValueOnce(new Error('out of range'));

        await expect(updateOrganization('project', values)).rejects.toThrow(
            'out of range',
        );

        expect(touchLivePages).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
    });

    it('refuses a profile that is not a full address, and a project the session cannot read', async () => {
        const fake = project();

        expect(
            await updateOrganization('project', {
                ...values,
                same_as: 'x.com/acme',
            }),
        ).toEqual({ error: 'Check the organization.' });

        expect(fake.writes()).toEqual([]);

        database({ data: null });

        expect(await updateOrganization('project', values)).toEqual({
            error: 'The project is gone.',
        });

        expect(touchLivePages).not.toHaveBeenCalled();
    });
});

describe('createAuthor', () => {
    it("adds the author to the project in the owner's session, with empty fields as nulls, and moves no live page", async () => {
        const fake = database({});

        expect(
            await createAuthor('project', {
                name: 'Jane Doe',
                title: '',
                url: '',
                same_as: 'https://x.com/jane',
            }),
        ).toEqual({});

        expect(fake.queries[0].calls).toEqual([
            [
                'insert',
                {
                    project_id: 'project',
                    name: 'Jane Doe',
                    title: null,
                    url: null,
                    same_as: ['https://x.com/jane'],
                },
            ],
        ]);

        expect(touchLivePages).not.toHaveBeenCalled();
        expect(refresh).toHaveBeenCalled();
    });

    it('refuses an author with no name', async () => {
        const fake = database({});

        expect(
            await createAuthor('project', {
                name: ' ',
                title: '',
                url: '',
                same_as: '',
            }),
        ).toEqual({ error: 'Check the author.' });

        expect(fake.writes()).toEqual([]);
    });
});

describe('updateAuthor', () => {
    const author = {
        name: 'Jane Doe',
        title: 'Head coach',
        url: 'https://acme.com/team/jane',
        same_as: '',
    };

    function stored(row: object | null) {
        return session(({ calls }) =>
            calls[0][0] === 'select'
                ? { data: row }
                : { data: [{ id: 'author' }] },
        );
    }

    it('updates the author of the project and moves the live pages that name the author', async () => {
        const fake = stored({ ...author, title: null, same_as: [] });

        expect(await updateAuthor('project', 'author', author)).toEqual({
            notice: null,
        });

        expect(fake.queries[0].calls).toEqual([
            ['select', 'name, title, url, same_as'],
            ['eq', 'project_id', 'project'],
            ['eq', 'id', 'author'],
            ['maybeSingle'],
        ]);

        expect(fake.queries[1].calls).toEqual([
            ['update', { ...author, same_as: [] }],
            ['eq', 'project_id', 'project'],
            ['eq', 'id', 'author'],
            ['select', 'id'],
        ]);

        expect(touchLivePages).toHaveBeenCalledWith('project', 'author');
    });

    it('writes nothing and moves no page when the edit changes nothing', async () => {
        const fake = stored({ ...author, same_as: [] });

        expect(
            await updateAuthor('project', 'author', {
                ...author,
                name: ' Jane Doe ',
            }),
        ).toEqual({ notice: null });

        expect(fake.writes()).toEqual([]);
        expect(touchLivePages).not.toHaveBeenCalled();
    });

    it('passes on the sentence of an after-publish run that did not start', async () => {
        stored({ ...author, title: null, same_as: [] });

        vi.mocked(touchLivePages).mockResolvedValueOnce('The change is saved.');

        expect(await updateAuthor('project', 'author', author)).toEqual({
            notice: 'The change is saved.',
        });
    });

    it('says the author is gone when the project has no such author, and moves no page', async () => {
        const fake = stored(null);

        expect(await updateAuthor('project', 'author', author)).toEqual({
            error: 'The author is gone from this project.',
        });

        expect(fake.writes()).toEqual([]);
        expect(touchLivePages).not.toHaveBeenCalled();
    });
});

describe('deleteAuthor', () => {
    function counts(
        authors: number,
        livePages: number,
        kinds = 0,
        deleted: object = { data: [{ id: 'author' }] },
    ) {
        return session(({ name, calls }) => {
            if (name === 'published_pages') {
                return { count: livePages };
            }

            if (name === 'page_kinds') {
                return { count: kinds };
            }

            return calls[0][0] === 'delete' ? deleted : { count: authors };
        });
    }

    it('deletes an author no live page and no kind names, when the project keeps another', async () => {
        const fake = counts(2, 0);

        expect(await deleteAuthor('project', 'author')).toEqual({});
        expect(fake.writes()).toEqual(['delete authors']);

        const live = fake.queries.find(
            ({ name }) => name === 'published_pages',
        );

        expect(live?.calls).toEqual(
            expect.arrayContaining([
                ['eq', 'author_id', 'author'],
                ['eq', 'pages.status', 'published'],
            ]),
        );

        const kinds = fake.queries.find(({ name }) => name === 'page_kinds');

        expect(kinds?.calls).toEqual(
            expect.arrayContaining([
                ['eq', 'project_id', 'project'],
                ['eq', 'author_id', 'author'],
            ]),
        );

        expect(refresh).toHaveBeenCalled();
    });

    it('keeps the last author of a project', async () => {
        const fake = counts(1, 0);

        expect(await deleteAuthor('project', 'author')).toEqual({
            error: 'A project needs at least one author. Add another author before you delete this one.',
        });

        expect(fake.writes()).toEqual([]);
    });

    it('keeps an author a live page names, and counts the pages', async () => {
        const fake = counts(3, 2);

        expect(await deleteAuthor('project', 'author')).toEqual({
            error: '2 live pages name this author. Pick another author in the editor and publish the changes, then delete this one.',
        });

        expect(fake.writes()).toEqual([]);

        counts(3, 1);

        expect(await deleteAuthor('project', 'author')).toEqual({
            error: expect.stringMatching(/^A live page names this author\./),
        });
    });

    it('keeps an author a page kind names, and counts the kinds', async () => {
        const fake = counts(3, 0, 3);

        expect(await deleteAuthor('project', 'author')).toEqual({
            error: '3 page kinds name this author. Pick another author for each in the Page kinds card, then delete this one.',
        });

        expect(fake.writes()).toEqual([]);

        counts(3, 0, 1);

        expect(await deleteAuthor('project', 'author')).toEqual({
            error: 'A page kind names this author. Pick another author for it in the Page kinds card, then delete this one.',
        });
    });

    it('gives the same sentence when the database refuses a delete the counts allowed', async () => {
        for (const [raised, sentence] of [
            [
                'A live page names the author.',
                /^A live page names this author\./,
            ],
            [
                'A page kind names the author.',
                /^A page kind names this author\./,
            ],
            [
                "The author is the project's last.",
                /^A project needs at least one author\./,
            ],
        ] as const) {
            counts(2, 0, 0, { error: { message: raised } });

            expect(await deleteAuthor('project', 'author'), raised).toEqual({
                error: expect.stringMatching(sentence),
            });
        }

        expect(refresh).not.toHaveBeenCalled();
    });

    it('throws on any other error of the delete', async () => {
        counts(2, 0, 0, { error: { message: 'permission denied' } });

        await expect(deleteAuthor('project', 'author')).rejects.toThrow(
            'permission denied',
        );
    });
});

describe('updateKindAuthors', () => {
    const values = {
        kinds: [
            { id: 'guide', author_id: 'jane' },
            { id: 'comparison', author_id: 'john' },
        ],
    };

    it("writes each kind's author in the session, filtered by project and kind, and moves no live page", async () => {
        const fake = database({ data: [{ id: 'kind' }] });

        expect(await updateKindAuthors('project', values)).toEqual({ values });

        expect(fake.queries.map(({ name, calls }) => [name, calls])).toEqual(
            values.kinds.map((kind) => [
                'page_kinds',
                [
                    ['update', { author_id: kind.author_id }],
                    ['eq', 'project_id', 'project'],
                    ['eq', 'id', kind.id],
                    ['select', 'id'],
                ],
            ]),
        );

        expect(getCurrentUser).toHaveBeenCalled();
        expect(touchLivePages).not.toHaveBeenCalled();
        expect(refresh).toHaveBeenCalled();
    });

    it("refuses a kind with no author, another project's author and a kind the project does not have", async () => {
        const fake = database({});

        expect(
            await updateKindAuthors('project', {
                kinds: [{ id: 'guide', author_id: '' }],
            }),
        ).toEqual({ error: 'Pick an author for each kind.' });

        expect(fake.writes()).toEqual([]);

        database({ error: { code: '23503', message: 'foreign key' } });

        expect(await updateKindAuthors('project', values)).toEqual({
            error: "Pick one of this project's authors.",
        });

        database({ data: [] });

        expect(await updateKindAuthors('project', values)).toEqual({
            error: 'A page kind is gone from this project.',
        });

        expect(refresh).not.toHaveBeenCalled();
    });
});

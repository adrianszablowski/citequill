'use server';

import { randomBytes } from 'node:crypto';

import { refresh } from 'next/cache';

import { getCurrentUser } from '@/features/auth/queries';
import { startCrawl } from '@/features/crawl/actions';
import {
    authorSchema,
    type AuthorValues,
    foreignAuthorError,
    kindAuthorsSchema,
    type KindAuthorsValues,
    organizationSchema,
    type OrganizationValues,
    organizationValues,
    projectSchema,
    type ProjectValues,
} from '@/features/projects/schema';
import { checkLogo, type Logo } from '@/features/publishing/logo';
import { saveLogo, touchLivePages } from '@/features/publishing/settings';
import { done, one } from '@/lib/supabase/result';
import { createClient } from '@/lib/supabase/server';

export async function createProject(values: ProjectValues) {
    await getCurrentUser();

    const parsed = projectSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the site address.' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from('projects')
        .insert({ name: parsed.data.domain, domain: parsed.data.domain })
        .select('id')
        .single();

    if (error) {
        return { error: error.message };
    }

    return startCrawl(data.id);
}

export async function regenerateBotSecret(projectId: string) {
    await getCurrentUser();

    const supabase = await createClient();

    const updated = await one(
        supabase
            .from('projects')
            .update({ bot_secret: randomBytes(32).toString('hex') })
            .eq('id', projectId)
            .select('id'),
    );

    if (updated.length === 0) {
        throw new Error('The project is gone.');
    }

    refresh();
}

export async function updateOrganization(
    projectId: string,
    values: OrganizationValues,
) {
    await getCurrentUser();

    const parsed = organizationSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the organization.' };
    }

    const supabase = await createClient();

    const { data: project, error } = await supabase
        .from('projects')
        .select(
            'organization_name, organization_url, organization_same_as, organization_logo_url, organization_logo_width, organization_logo_height',
        )
        .eq('id', projectId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!project) {
        return { error: 'The project is gone.' };
    }

    const { name, url, logo_url, same_as } = parsed.data;
    const isLogoKept = logo_url === project.organization_logo_url;
    const checked = logo_url ? await checkLogo(logo_url) : { logo: null };

    if ('error' in checked && !isLogoKept) {
        return { error: checked.error, field: 'logo_url' as const };
    }

    const isOwnersChanged =
        name !== project.organization_name ||
        url !== project.organization_url ||
        same_as.join('\n') !== project.organization_same_as.join('\n');

    const newLogo =
        'logo' in checked && !isStoredLogo(checked.logo, project)
            ? checked.logo
            : undefined;

    if (isOwnersChanged) {
        await done(
            supabase
                .from('projects')
                .update({
                    organization_name: name,
                    organization_url: url,
                    organization_same_as: same_as,
                })
                .eq('id', projectId),
        );
    }

    if (newLogo !== undefined) {
        await saveLogo(projectId, newLogo);
    }

    const notice =
        isOwnersChanged || newLogo !== undefined
            ? await touchLivePages(projectId)
            : null;

    refresh();

    return {
        values: organizationValues({
            organization_name: name,
            organization_url: url,
            organization_logo_url: logo_url,
            organization_same_as: same_as,
        }),
        warning: 'error' in checked ? checked.error : null,
        notice,
    };
}

export async function createAuthor(projectId: string, values: AuthorValues) {
    await getCurrentUser();

    const parsed = authorSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the author.' };
    }

    const supabase = await createClient();

    await done(
        supabase
            .from('authors')
            .insert({ project_id: projectId, ...parsed.data }),
    );

    refresh();

    return {};
}

export async function updateAuthor(
    projectId: string,
    authorId: string,
    values: AuthorValues,
) {
    await getCurrentUser();

    const parsed = authorSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the author.' };
    }

    const supabase = await createClient();

    const { data: stored, error } = await supabase
        .from('authors')
        .select('name, title, url, same_as')
        .eq('project_id', projectId)
        .eq('id', authorId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!stored) {
        return { error: authorGone };
    }

    if (JSON.stringify(stored) === JSON.stringify(parsed.data)) {
        return { notice: null };
    }

    const updated = await one(
        supabase
            .from('authors')
            .update(parsed.data)
            .eq('project_id', projectId)
            .eq('id', authorId)
            .select('id'),
    );

    if (updated.length === 0) {
        return { error: authorGone };
    }

    const notice = await touchLivePages(projectId, authorId);

    refresh();

    return { notice };
}

export async function deleteAuthor(projectId: string, authorId: string) {
    await getCurrentUser();

    const supabase = await createClient();

    const [authors, livePages, kinds] = await Promise.all([
        supabase
            .from('authors')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId),
        supabase
            .from('published_pages')
            .select('page_id, pages!inner(status)', {
                count: 'exact',
                head: true,
            })
            .eq('project_id', projectId)
            .eq('author_id', authorId)
            .eq('pages.status', 'published'),
        supabase
            .from('page_kinds')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('author_id', authorId),
    ]);

    for (const { error } of [authors, livePages, kinds]) {
        if (error) {
            throw new Error(error.message);
        }
    }

    const refusals = [
        {
            isRefused: (authors.count ?? 0) <= 1,
            raised: "The author is the project's last.",
            error: 'A project needs at least one author. Add another author before you delete this one.',
        },
        {
            isRefused: Boolean(livePages.count),
            raised: 'A live page names the author.',
            error: `${namedBy(livePages.count, 'live page')} this author. Pick another author in the editor and publish the changes, then delete this one.`,
        },
        {
            isRefused: Boolean(kinds.count),
            raised: 'A page kind names the author.',
            error: `${namedBy(kinds.count, 'page kind')} this author. Pick another author for ${(kinds.count ?? 0) > 1 ? 'each' : 'it'} in the Page kinds card, then delete this one.`,
        },
    ];

    const refused = refusals.find(({ isRefused }) => isRefused);

    if (refused) {
        return { error: refused.error };
    }

    const { data: deleted, error } = await supabase
        .from('authors')
        .delete()
        .eq('project_id', projectId)
        .eq('id', authorId)
        .select('id');

    if (error) {
        const raised = refusals.find(({ raised }) => raised === error.message);

        if (raised) {
            return { error: raised.error };
        }

        throw new Error(error.message);
    }

    if (deleted.length === 0) {
        return { error: authorGone };
    }

    refresh();

    return {};
}

export async function updateKindAuthors(
    projectId: string,
    values: KindAuthorsValues,
) {
    await getCurrentUser();

    const parsed = kindAuthorsSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Pick an author for each kind.' };
    }

    const supabase = await createClient();

    for (const kind of parsed.data.kinds) {
        const { data, error } = await supabase
            .from('page_kinds')
            .update({ author_id: kind.author_id })
            .eq('project_id', projectId)
            .eq('id', kind.id)
            .select('id');

        if (error?.code === foreignKeyViolation) {
            return { error: foreignAuthorError };
        }

        if (error) {
            throw new Error(error.message);
        }

        if (data.length === 0) {
            return { error: 'A page kind is gone from this project.' };
        }
    }

    refresh();

    return { values: parsed.data };
}

function namedBy(count: number | null, noun: string) {
    return count && count > 1 ? `${count} ${noun}s name` : `A ${noun} names`;
}

function isStoredLogo(
    logo: Logo | null,
    project: {
        organization_logo_url: string | null;
        organization_logo_width: number | null;
        organization_logo_height: number | null;
    },
) {
    return (
        (logo?.url ?? null) === project.organization_logo_url &&
        (logo?.width ?? null) === project.organization_logo_width &&
        (logo?.height ?? null) === project.organization_logo_height
    );
}

const authorGone = 'The author is gone from this project.';

const foreignKeyViolation = '23503';

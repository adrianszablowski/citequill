'use server';

import { refresh } from 'next/cache';

import { withoutSlash } from '@/features/audit/queue';
import { getCurrentUser } from '@/features/auth/queries';
import { publish, unpublish } from '@/features/publishing/publish';
import { redirectUrl } from '@/features/publishing/redirect';
import {
    unpublishSchema,
    type UnpublishValues,
} from '@/features/publishing/schema';
import { createClient } from '@/lib/supabase/server';

export async function publishPage(projectId: string, pageId: string) {
    await getCurrentUser();

    if (!(await ownedPage(projectId, pageId))) {
        return { error: 'The page is gone from this project.' };
    }

    const result = await publish(projectId, [pageId]);

    if (!('error' in result)) {
        refresh();
    }

    return result;
}

export async function unpublishPage(
    projectId: string,
    pageId: string,
    values: UnpublishValues,
) {
    await getCurrentUser();

    const parsed = unpublishSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check where the address sends visitors.' };
    }

    const live = (await ownedPage(projectId, pageId))?.published_pages;

    if (!live) {
        return {
            error: 'The page is not live, so there is nothing to unpublish.',
        };
    }

    const redirect =
        parsed.data.answer === 'redirect'
            ? redirectUrl(parsed.data.to, live.url)
            : null;

    if (redirect && withoutSlash(redirect) === withoutSlash(live.url)) {
        return {
            error: "The redirect points at the page's own address. Give another one.",
        };
    }

    const result = await unpublish(projectId, pageId, redirect);

    if (!('error' in result)) {
        refresh();
    }

    return result;
}

async function ownedPage(projectId: string, pageId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('pages')
        .select('id, published_pages(url)')
        .eq('project_id', projectId)
        .eq('id', pageId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

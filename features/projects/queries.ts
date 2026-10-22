import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export const getProjectList = cache(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('projects')
        .select('id, name, domain, organization_logo_url')
        .order('created_at');

    if (error) {
        throw error;
    }

    return data;
});

export type ProjectListItem = Awaited<
    ReturnType<typeof getProjectList>
>[number];

export const getProject = cache(async (id: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('projects')
        .select('id, name, domain')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
});

export async function getBotSecret(projectId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('projects')
        .select('bot_secret')
        .eq('id', projectId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data?.bot_secret ?? null;
}

export async function getOrganization(projectId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('projects')
        .select(
            'name, organization_name, organization_url, organization_logo_url, organization_logo_width, organization_logo_height, organization_same_as',
        )
        .eq('id', projectId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

export const getProjectLocales = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('project_locales')
        .select('id, locale, base_url, is_default')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false })
        .order('locale');

    if (error) {
        throw error;
    }

    return data;
});

export const getPageKinds = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('page_kinds')
        .select('id, name, url_prefix, author_id, skills(name)')
        .eq('project_id', projectId)
        .order('name');

    if (error) {
        throw error;
    }

    return data;
});

export const getAuthors = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('authors')
        .select('id, name, title, url, same_as')
        .eq('project_id', projectId)
        .order('name');

    if (error) {
        throw error;
    }

    return data;
});

export type Author = Awaited<ReturnType<typeof getAuthors>>[number];

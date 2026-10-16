'use server';

import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/queries';
import { projectSchema, type ProjectValues } from '@/features/projects/schema';
import { sectionHref } from '@/lib/sections';
import { createClient } from '@/lib/supabase/server';

export async function createProject(values: ProjectValues) {
    await getCurrentUser();

    const parsed = projectSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the site address.' };
    }

    const supabase = await createClient();

    // The crawl in step 2 replaces the name with the site's own; until then
    // the domain is the only name the project has.
    const { data, error } = await supabase
        .from('projects')
        .insert({ name: parsed.data.domain, domain: parsed.data.domain })
        .select('id')
        .single();

    if (error) {
        return { error: error.message };
    }

    redirect(sectionHref(data.id, 'pages'));
}

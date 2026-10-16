'use server';

import { getCurrentUser } from '@/features/auth/queries';
import { startCrawl } from '@/features/crawl/actions';
import { projectSchema, type ProjectValues } from '@/features/projects/schema';
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

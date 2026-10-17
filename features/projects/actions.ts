'use server';

import { randomBytes } from 'node:crypto';

import { refresh } from 'next/cache';

import { getCurrentUser } from '@/features/auth/queries';
import { startCrawl } from '@/features/crawl/actions';
import { projectSchema, type ProjectValues } from '@/features/projects/schema';
import { one } from '@/lib/supabase/result';
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

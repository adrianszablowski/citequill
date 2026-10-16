import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export const getProjectList = cache(async () => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('projects')
        .select('id, name, domain')
        .order('created_at');

    if (error) {
        throw error;
    }

    return data;
});

export type ProjectListItem = Awaited<
    ReturnType<typeof getProjectList>
>[number];

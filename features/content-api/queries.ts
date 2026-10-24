import 'server-only';

import { createClient } from '@/lib/supabase/server';

export async function getIntegration(projectId: string) {
    const supabase = await createClient();

    const [project, keys, locales] = await Promise.all([
        supabase
            .from('projects')
            .select('site_id')
            .eq('id', projectId)
            .maybeSingle(),
        supabase
            .from('site_keys')
            .select('id, name, key_hint, last_used_on')
            .eq('project_id', projectId)
            .order('created_at'),
        supabase
            .from('project_locales')
            .select('locale, base_url')
            .eq('project_id', projectId)
            .order('is_default', { ascending: false })
            .order('locale'),
    ]);

    for (const { error } of [project, keys, locales]) {
        if (error) {
            throw error;
        }
    }

    return project.data
        ? {
              siteId: project.data.site_id,
              keys: keys.data ?? [],
              locales: locales.data ?? [],
          }
        : null;
}

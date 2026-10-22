import 'server-only';

import type { Logo } from '@/features/publishing/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { done } from '@/lib/supabase/result';

export async function saveLogo(projectId: string, logo: Logo | null) {
    await done(
        createAdminClient()
            .from('projects')
            .update({
                organization_logo_url: logo?.url ?? null,
                organization_logo_width: logo?.width ?? null,
                organization_logo_height: logo?.height ?? null,
            })
            .eq('id', projectId),
    );
}

export async function touchLivePages(projectId: string, authorId?: string) {
    await done(
        createAdminClient().rpc('touch_live_pages', {
            project: projectId,
            author: authorId,
        }),
    );
}

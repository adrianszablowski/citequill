import 'server-only';

import * as z from 'zod';

import { startAfterPublish } from '@/features/publishing/after-publish';
import type { Logo } from '@/features/publishing/logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { done, one } from '@/lib/supabase/result';

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
    const touched = z.array(z.unknown()).parse(
        await one(
            createAdminClient().rpc('touch_live_pages', {
                project: projectId,
                author: authorId,
            }),
        ),
    );

    return touched.length > 0 ? startAfterPublish(projectId, 'settings') : null;
}

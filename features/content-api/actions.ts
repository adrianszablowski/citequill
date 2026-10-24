'use server';

import { refresh } from 'next/cache';

import { getCurrentUser } from '@/features/auth/queries';
import { clearApiCache } from '@/features/content-api/cache';
import { generateKey } from '@/features/content-api/key';
import {
    keyLimitSentence,
    siteKeySchema,
    type SiteKeyValues,
} from '@/features/content-api/schema';
import { createClient } from '@/lib/supabase/server';

export async function createSiteKey(projectId: string, values: SiteKeyValues) {
    await getCurrentUser();

    const parsed = siteKeySchema.safeParse(values);

    if (!parsed.success) {
        return { error: parsed.error.issues[0].message };
    }

    const { key, hash, hint } = generateKey();

    const { error } = await (await createClient()).from('site_keys').insert({
        project_id: projectId,
        name: parsed.data.name,
        key_hash: hash,
        key_hint: hint,
    });

    if (error?.message === keyLimitRaised) {
        return { error: keyLimitSentence };
    }

    if (error) {
        throw new Error(error.message);
    }

    refresh();

    return { key };
}

export async function deleteSiteKey(projectId: string, keyId: string) {
    await getCurrentUser();

    const { data, error } = await (
        await createClient()
    )
        .from('site_keys')
        .delete()
        .eq('project_id', projectId)
        .eq('id', keyId)
        .select('id');

    if (error) {
        throw new Error(error.message);
    }

    if (data.length === 0) {
        return { error: 'The key is gone from this project.' };
    }

    clearApiCache(projectId);
    refresh();

    return {};
}

// The message guard_site_key_limit raises in supabase/migrations/, which
// changes with it.
const keyLimitRaised = 'The project has 10 keys.';

import 'server-only';

import { problem } from '@/features/content-api/answer';
import { isKey, keyHash } from '@/features/content-api/key';
import { createAdminClient } from '@/lib/supabase/admin';
import { one } from '@/lib/supabase/result';

export type Access = Exclude<Awaited<ReturnType<typeof authorize>>, Response>;

export async function authorize(request: Request, siteId: string) {
    const bearer = /^Bearer +(\S+) *$/i.exec(
        request.headers.get('Authorization') ?? '',
    );

    if (!bearer) {
        return problem('missing_key');
    }

    if (!isKey(bearer[1])) {
        return problem('invalid_key');
    }

    const hash = keyHash(bearer[1]);

    const [owner] = await one(
        createAdminClient().rpc('api_key_project', { secret_hash: hash }),
    );

    if (!owner) {
        return problem('invalid_key');
    }

    if (owner.site_id !== siteId) {
        return problem('wrong_site');
    }

    return { projectId: owner.project_id, hash, siteId };
}

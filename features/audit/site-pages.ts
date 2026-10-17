import { createAdminClient } from '@/lib/supabase/admin';
import { one } from '@/lib/supabase/result';
import type { TablesInsert } from '@/lib/types/database';

export async function writeSitePages(rows: TablesInsert<'site_pages'>[]) {
    const supabase = createAdminClient();
    const seenAt = new Date().toISOString();
    const ids = new Map<string, string>();

    for (let start = 0; start < rows.length; start += rowsPerWrite) {
        const written = await one(
            supabase
                .from('site_pages')
                .upsert(
                    rows.slice(start, start + rowsPerWrite).map((row) => ({
                        ...row,
                        last_seen_at: seenAt,
                        is_gone: false,
                    })),
                    { onConflict: 'project_id,url' },
                )
                .select('id, url'),
        );

        for (const { id, url } of written) {
            ids.set(url, id);
        }
    }

    return ids;
}

export const rowsPerWrite = 500;

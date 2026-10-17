import { createAdminClient } from '@/lib/supabase/admin';
import { done } from '@/lib/supabase/result';
import type { TablesInsert } from '@/lib/types/database';

export async function writeSitePages(rows: TablesInsert<'site_pages'>[]) {
    const supabase = createAdminClient();
    const seenAt = new Date().toISOString();

    for (let start = 0; start < rows.length; start += rowsPerWrite) {
        await done(
            supabase.from('site_pages').upsert(
                rows.slice(start, start + rowsPerWrite).map((row) => ({
                    ...row,
                    last_seen_at: seenAt,
                    is_gone: false,
                })),
                { onConflict: 'project_id,url' },
            ),
        );
    }
}

const rowsPerWrite = 500;

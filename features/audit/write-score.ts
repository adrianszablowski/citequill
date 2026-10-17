import type { SupabaseClient } from '@supabase/supabase-js';

import { homePages, siteBaseUrls } from '@/features/audit/queue';
import {
    checksRun,
    scoreAudit,
    scoredPageColumns,
} from '@/features/audit/score';
import { all, done, one } from '@/lib/supabase/result';
import type { Database } from '@/lib/types/database';

export interface ScoreRequest {
    projectId: string;
    auditId: string;
    hasCrossPageChecks: boolean;
}

export async function writeScore(
    supabase: SupabaseClient<Database>,
    { projectId, auditId, hasCrossPageChecks }: ScoreRequest,
) {
    const [project, audit, locales, pages, findings, marks] = await Promise.all(
        [
            one(
                supabase
                    .from('projects')
                    .select('domain, obey_robots')
                    .eq('id', projectId)
                    .single(),
            ),
            one(
                supabase
                    .from('audits')
                    .select('robots_rules')
                    .eq('id', auditId)
                    .single(),
            ),
            one(
                supabase
                    .from('project_locales')
                    .select('base_url')
                    .eq('project_id', projectId),
            ),
            all((from, to) =>
                supabase
                    .from('site_pages')
                    .select(scoredPageColumns)
                    .eq('last_audit_id', auditId)
                    .order('id')
                    .range(from, to),
            ),
            all((from, to) =>
                supabase
                    .from('audit_findings')
                    .select(
                        'id, check, severity, site_page_id, subject, selector',
                    )
                    .eq('audit_id', auditId)
                    .order('id')
                    .range(from, to),
            ),
            all((from, to) =>
                supabase
                    .from('audit_marks')
                    .select('check, url, selector')
                    .eq('project_id', projectId)
                    .order('id')
                    .range(from, to),
            ),
        ],
    );

    const { results, ...score } = scoreAudit({
        checks: checksRun({
            hasCrossPageChecks,
            hasDiscovered: audit.robots_rules !== null,
            obeyRobots: project.obey_robots,
        }),
        pages,
        findings,
        marks,
        homes: homePages(siteBaseUrls(project.domain, locales)),
    });

    await done(
        supabase.rpc('score_audit', {
            audit: auditId,
            ...score,
            results,
        }),
    );
}

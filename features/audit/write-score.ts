import type { SupabaseClient } from '@supabase/supabase-js';

import { auditChanges, comparedPair } from '@/features/audit/changes';
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
                    .select('robots_rules, created_at')
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
                        'id, check, severity, site_page_id, subject, selector, fingerprint',
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

    const older = await one(
        supabase
            .from('audits')
            .select('id, created_at, score, checks_scored, runs(status)')
            .eq('project_id', projectId)
            .lt('created_at', audit.created_at)
            .order('created_at', { ascending: false }),
    );

    const pair = comparedPair(
        score,
        older.map(({ runs, ...previous }) => ({ run: runs, audit: previous })),
    );

    const changes =
        pair &&
        auditChanges(
            await all((from, to) =>
                supabase
                    .from('audit_findings')
                    .select('fingerprint')
                    .eq('audit_id', pair.previousId)
                    .order('id')
                    .range(from, to),
            ),
            findings,
        );

    await done(
        supabase.rpc('score_audit', {
            audit: auditId,
            ...score,
            results,
            findings_fixed: changes?.fixed,
            findings_new: changes?.added,
        }),
    );
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { auditComparison, previousAudit } from '@/features/audit/changes';
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
                    .select('robots_rules, cdn_test, created_at, checks_run')
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

    const today = checksRun({
        hasCrossPageChecks,
        hasDiscovered: audit.robots_rules !== null,
        obeyRobots: project.obey_robots,
        hasPassedCdnTest: audit.cdn_test === 'passed',
    });

    const stored = audit.checks_run;

    const checks = stored
        ? today.filter((check) => stored.includes(check))
        : today;

    const { results, ...score } = scoreAudit({
        checks,
        pages,
        findings,
        marks,
        homes: homePages(siteBaseUrls(project.domain, locales)),
    });

    const older = await one(
        supabase
            .from('audits')
            .select('id, is_gated, checks_run, runs(status)')
            .eq('project_id', projectId)
            .lt('created_at', audit.created_at)
            .order('created_at', { ascending: false }),
    );

    const previous = previousAudit(
        older.map(({ runs, ...earlier }) => ({ run: runs, audit: earlier })),
    );

    let comparison = null;

    if (previous?.checks_run) {
        const [previousResults, previousFindings] = await Promise.all([
            all((from, to) =>
                supabase
                    .from('audit_check_results')
                    .select(
                        'check, pages_checked, pages_failed, pages_intended',
                    )
                    .eq('audit_id', previous.id)
                    .order('check')
                    .range(from, to),
            ),
            all((from, to) =>
                supabase
                    .from('audit_findings')
                    .select('fingerprint, check')
                    .eq('audit_id', previous.id)
                    .order('id')
                    .range(from, to),
            ),
        ]);

        comparison = auditComparison(
            {
                checksRun: previous.checks_run,
                isGated: previous.is_gated,
                results: previousResults,
                findings: previousFindings,
            },
            { checksRun: checks, isGated: score.is_gated, results, findings },
        );
    }

    await done(
        supabase.rpc('score_audit', {
            audit: auditId,
            ...score,
            results,
            checks_run: checks,
            score_difference: comparison?.difference,
            findings_fixed: comparison?.fixed,
            findings_new: comparison?.added,
        }),
    );
}

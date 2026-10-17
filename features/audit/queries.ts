import 'server-only';

import { cache } from 'react';

import { catalogue } from '@/features/audit/catalogue';
import { auditChanges } from '@/features/audit/changes';
import { startedAgo } from '@/features/audit/format';
import { checkSort, sitePageSort } from '@/features/audit/list-query';
import {
    type FindingListQuery,
    severityColumns,
} from '@/features/audit/schema';
import { isSiteCheck } from '@/features/audit/score';
import { titlePattern } from '@/features/pages/list-query';
import { isStaleRun } from '@/features/runs/stale';
import { all, paged } from '@/lib/supabase/result';
import { createClient } from '@/lib/supabase/server';

export const getAudits = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('runs')
        .select(
            'id, status, error, started_at, progressed_at, workflow_run_id, audits(id, created_at, pages_read, pages_indexable, duration_s, is_partial, score, is_gated, checks_scored, checks_total)',
        )
        .eq('project_id', projectId)
        .eq('trigger', 'audit')
        .order('started_at', { ascending: false });

    if (error) {
        throw error;
    }

    const now = Date.now();

    return data.map(({ audits: audit, ...run }) => ({
        run,
        audit,
        status: isStaleRun(run, now) ? ('stalled' as const) : run.status,
        started: startedAgo(run.started_at, now),
    }));
});

export type Audit = Awaited<ReturnType<typeof getAudits>>[number];

export async function getChanges(latestId: string, previousId: string) {
    const supabase = await createClient();

    const fingerprints = (auditId: string) =>
        all((from, to) =>
            supabase
                .from('audit_findings')
                .select('fingerprint')
                .eq('audit_id', auditId)
                .order('id')
                .range(from, to),
        );

    const [latest, previous] = await Promise.all([
        fingerprints(latestId),
        fingerprints(previousId),
    ]);

    return auditChanges(previous, latest);
}

export async function getFindingList(auditId: string, query: FindingListQuery) {
    if (query.check || query.site_page) {
        return {
            kind: 'finding' as const,
            ...(await getFindings(auditId, query)),
        };
    }

    return query.view === 'page'
        ? {
              kind: 'site-page' as const,
              ...(await getSitePageList(auditId, query)),
          }
        : { kind: 'check' as const, ...(await getCheckList(auditId, query)) };
}

export async function getCheckList(auditId: string, query: FindingListQuery) {
    const supabase = await createClient();
    const first = (query.page - 1) * query.size;
    const byPages = checkSort(query) === 'pages';

    let request = supabase
        .rpc(
            'audit_check_list',
            { audit: auditId, ...(query.locale && { locale: query.locale }) },
            { count: 'exact' },
        )
        .order(byPages ? 'pages_failed' : 'severity_rank', {
            ascending: !byPages,
        })
        .order(byPages ? 'severity_rank' : 'pages_failed', {
            ascending: byPages,
        })
        .order('check')
        .range(first, first + query.size - 1);

    if (query.severity) {
        request = request.eq('severity', query.severity);
    }

    if (query.area) {
        request = request.in(
            'check',
            catalogue
                .filter((check) => check.area === query.area)
                .map((check) => check.id),
        );
    }

    return paged(await request);
}

export type CheckListItem = NonNullable<
    Awaited<ReturnType<typeof getCheckList>>['rows']
>[number];

export async function getSitePageList(
    auditId: string,
    query: FindingListQuery,
) {
    const supabase = await createClient();
    const first = (query.page - 1) * query.size;

    let request = supabase.rpc(
        'audit_page_list',
        { audit: auditId },
        { count: 'exact' },
    );

    request =
        sitePageSort(query) === 'url'
            ? request.order('url')
            : request.order('findings', { ascending: false }).order('url');

    request = request.range(first, first + query.size - 1);

    if (query.locale) {
        request = request.eq('locale', query.locale);
    }

    if (query.severity) {
        request = request.gt(severityColumns[query.severity], 0);
    }

    if (query.written) {
        request =
            query.written === 'yes'
                ? request.not('page_id', 'is', null)
                : request.is('page_id', null);
    }

    if (query.q) {
        request = request.ilike('url', titlePattern(query.q));
    }

    return paged(await request);
}

export type SitePageListItem = NonNullable<
    Awaited<ReturnType<typeof getSitePageList>>['rows']
>[number];

export async function getFindings(auditId: string, query: FindingListQuery) {
    const supabase = await createClient();
    const first = (query.page - 1) * query.size;

    const locale =
        query.check && !isSiteCheck(query.check) ? query.locale : undefined;

    let request = supabase
        .from('audit_findings')
        .select(
            'id, check, severity, subject, selector, snippet, is_intended, site_page_id, site_pages(url, locale)',
            { count: 'exact' },
        )
        .eq('audit_id', auditId);

    request = query.check
        ? request.order('site_pages(url)', { nullsFirst: true })
        : request.order('check').order('subject', { nullsFirst: true });

    request = request.order('id').range(first, first + query.size - 1);

    if (query.check) {
        request = request.eq('check', query.check);
    }

    if (query.site_page) {
        request = request.eq('site_page_id', query.site_page);
    }

    if (locale) {
        request = request
            .eq('site_pages.locale', locale)
            .not('site_pages', 'is', null);
    }

    return paged(await request);
}

export type FindingItem = NonNullable<
    Awaited<ReturnType<typeof getFindings>>['rows']
>[number];

export async function getSitePage(projectId: string, sitePageId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('site_pages')
        .select('id, url, status_code, canonical_url, title, page_id')
        .eq('project_id', projectId)
        .eq('id', sitePageId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

export async function getMarks(projectId: string) {
    const supabase = await createClient();

    return all((from, to) =>
        supabase
            .from('audit_marks')
            .select('check, url, selector')
            .eq('project_id', projectId)
            .order('id')
            .range(from, to),
    );
}

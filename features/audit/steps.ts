import { FatalError } from 'workflow';

import { type SiteClient, siteClient } from '@/features/audit/client';
import { findingRows } from '@/features/audit/finding';
import { observeRead, type Read } from '@/features/audit/observe';
import { checkPage } from '@/features/audit/page-checks';
import {
    firstPace,
    hasStopped,
    type Pace,
    requestsInFlight,
    stepBudgetMs,
    stoppedAnswering,
} from '@/features/audit/pacing';
import {
    addToQueue,
    homePages,
    linkTarget,
    nextBatch,
    type QueueEntry,
    siteBaseUrls,
    siteHosts,
    siteOrigins,
} from '@/features/audit/queue';
import {
    blockedBy,
    googlebotBlocks,
    type RobotsFile,
    robotsFile,
} from '@/features/audit/robots';
import { robotsChecks } from '@/features/audit/robots-checks';
import { crossPageChecks, scoredPageColumns } from '@/features/audit/score';
import { siteChecks, siteHalves } from '@/features/audit/site-checks';
import { rowsPerWrite, writeSitePages } from '@/features/audit/site-pages';
import { sitemapChecks } from '@/features/audit/sitemap-checks';
import { readSitemaps } from '@/features/audit/sitemaps';
import { writeScore } from '@/features/audit/write-score';
import { pagePath } from '@/features/pages/draft';
import { finishRun, markProgress } from '@/features/runs/steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { all, done, one } from '@/lib/supabase/result';
import type { Json, TablesInsert } from '@/lib/types/database';

export interface Reading {
    hasWork: boolean;
    pace: Pace;
}

export async function discoverSite(
    projectId: string,
    runId: string,
    auditId: string,
): Promise<Pace> {
    'use step';

    const supabase = createAdminClient();

    const run = await one(
        supabase.from('runs').select('status').eq('id', runId).single(),
    );

    if (run.status !== 'running') {
        return firstPace;
    }

    const site = await loadSite(projectId);

    const client = siteClient({
        ...site.access,
        pace: firstPace,
        deadline: Date.now() + stepBudgetMs,
    });

    const files: RobotsFile[] = [];

    for (const origin of siteOrigins(site.access.hosts)) {
        const url = `${origin}/robots.txt`;
        const fetched = await client.read(url);

        if (fetched !== null) {
            files.push(
                robotsFile(url, fetched instanceof Error ? null : fetched),
            );
        }
    }

    const named = files.flatMap((file) => file.sitemaps);

    const sitemaps = await readSitemaps(
        client,
        named.length > 0
            ? named
            : site.origins.flatMap((origin) => [
                  `${origin}/sitemap.xml`,
                  `${origin}/sitemap_index.xml`,
              ]),
        site.access.hosts,
    );

    await done(
        supabase
            .from('audit_findings')
            .delete()
            .eq('audit_id', auditId)
            .is('site_page_id', null),
    );

    await writeFindings(
        findingRows(
            [
                ...robotsChecks(files, site.homes),
                ...sitemapChecks(sitemaps, { named, now: Date.now() }),
            ],
            { projectId, auditId, pageIds: new Map() },
        ),
    );

    const { queue, isCapped } = addToQueue(new Map(), [
        ...site.homes.map((url) => ({ url, depth: 0 })),
        ...sitemaps
            .flatMap((file) => file.sitemap.urls)
            .flatMap(({ loc }) => {
                const url = linkTarget(loc, site.access.hosts);

                return url ? [{ url, depth: null, inSitemap: true }] : [];
            }),
    ]);

    await writeQueue(auditId, [...queue.values()]);

    await done(
        supabase
            .from('audits')
            .update({
                robots_rules: files as unknown as Json,
                request_count: client.counts.requests,
                host_429_count: client.counts.tooMany,
                host_5xx_count: client.counts.serverErrors,
                ...(isCapped && { is_partial: true }),
            })
            .eq('id', auditId),
    );

    await markProgress(runId);

    if (hasStopped(client.pace())) {
        throw new FatalError(stoppedAnswering);
    }

    return client.pace();
}

export async function readPages(
    projectId: string,
    runId: string,
    auditId: string,
    pace: Pace,
): Promise<Reading> {
    'use step';

    const supabase = createAdminClient();

    const run = await one(
        supabase.from('runs').select('status').eq('id', runId).single(),
    );

    if (run.status !== 'running') {
        return { hasWork: false, pace };
    }

    const [site, audit, queue] = await Promise.all([
        loadSite(projectId),
        one(
            supabase
                .from('audits')
                .select(
                    'robots_rules, request_count, host_429_count, host_5xx_count',
                )
                .eq('id', auditId)
                .single(),
        ),
        loadQueue(auditId),
    ]);

    const batch = nextBatch(queue);

    if (batch.length === 0) {
        return { hasWork: false, pace };
    }

    const files = (audit.robots_rules ?? []) as unknown as RobotsFile[];

    const client = siteClient({
        ...site.access,
        pace,
        deadline: Date.now() + stepBudgetMs,
    });

    const reads = await readBatch(
        client,
        batch,
        blockedBy(files, site.obeyRobots),
    );

    const pageIds = await loadPageIds(projectId, site.locales);

    const observed = reads.map((read) =>
        observeRead(read, {
            projectId,
            auditId,
            locales: site.locales,
            hosts: site.access.hosts,
            pageIds,
        }),
    );

    const added = addToQueue(
        queue,
        observed.flatMap((page) => page.candidates),
    );

    const next = new Map(added.queue);
    const touched = new Set(added.touched);

    for (const { entry, outcome } of reads) {
        next.set(entry.url, {
            ...next.get(entry.url)!,
            state: outcome === 'blocked' ? 'blocked' : 'read',
        });

        touched.add(entry.url);
    }

    const previous = await one(
        supabase
            .from('site_pages')
            .select('url, redirect_to')
            .eq('project_id', projectId)
            .in(
                'url',
                batch.map((entry) => entry.url),
            ),
    );

    const sitePageIds = await writeSitePages(
        observed.map(({ row }) => ({
            ...row,
            inbound_links: next.get(row.url)!.inbound_links,
        })),
    );

    const checks = {
        obeyRobots: site.obeyRobots,
        isDisallowed: googlebotBlocks(files),
        locales: site.locales,
        hosts: site.access.hosts,
        previousRedirects: new Map(
            previous.flatMap(({ url, redirect_to }) =>
                redirect_to ? [[url, redirect_to] as const] : [],
            ),
        ),
        now: Date.now(),
    };

    if (sitePageIds.size > 0) {
        await done(
            supabase
                .from('audit_findings')
                .delete()
                .eq('audit_id', auditId)
                .in('site_page_id', [...sitePageIds.values()]),
        );
    }

    await writeFindings(
        findingRows(
            reads.flatMap((read, index) =>
                checkPage(read, observed[index], checks),
            ),
            { projectId, auditId, pageIds: sitePageIds },
        ),
    );

    await writeQueue(
        auditId,
        [...touched].map((url) => next.get(url)!),
    );

    await done(
        supabase
            .from('audits')
            .update({
                pages_read: [...next.values()].filter(
                    (entry) => entry.state === 'read',
                ).length,
                request_count: audit.request_count + client.counts.requests,
                host_429_count: audit.host_429_count + client.counts.tooMany,
                host_5xx_count:
                    audit.host_5xx_count + client.counts.serverErrors,
                ...(added.isCapped && { is_partial: true }),
            })
            .eq('id', auditId),
    );

    await markProgress(runId);

    if (hasStopped(client.pace())) {
        throw new FatalError(stoppedAnswering);
    }

    return {
        hasWork: [...next.values()].some((entry) => entry.state === 'queued'),
        pace: client.pace(),
    };
}

export async function checkSite(
    projectId: string,
    runId: string,
    auditId: string,
) {
    'use step';

    const supabase = createAdminClient();

    const run = await one(
        supabase.from('runs').select('status').eq('id', runId).single(),
    );

    if (run.status !== 'running') {
        return;
    }

    const [site, audit, rows] = await Promise.all([
        loadSite(projectId),
        one(
            supabase
                .from('audits')
                .select('robots_rules')
                .eq('id', auditId)
                .single(),
        ),
        all((from, to) =>
            supabase
                .from('site_pages')
                .select(
                    `${scoredPageColumns}, body_hash, body_simhash, title, description` as const,
                )
                .eq('last_audit_id', auditId)
                .order('id')
                .range(from, to),
        ),
    ]);

    const files = (audit.robots_rules ?? []) as unknown as RobotsFile[];

    const findings = siteChecks(rows, {
        homes: site.homes,
        hosts: site.access.hosts,
        isDisallowed: googlebotBlocks(files),
        isHttpsSite: site.homes.some((home) => home.startsWith('https:')),
    });

    await done(
        supabase
            .from('audit_findings')
            .delete()
            .eq('audit_id', auditId)
            .in('check', crossPageChecks),
    );

    for (const [check, reason] of siteHalves) {
        await done(
            supabase
                .from('audit_findings')
                .delete()
                .eq('audit_id', auditId)
                .eq('check', check)
                .contains('detail', { reason }),
        );
    }

    await writeFindings(
        findingRows(findings, {
            projectId,
            auditId,
            pageIds: new Map(rows.map((row) => [row.url, row.id])),
        }),
    );

    await markProgress(runId);
}

export async function closeAudit(
    projectId: string,
    runId: string,
    auditId: string,
) {
    'use step';

    const supabase = createAdminClient();

    const run = await one(
        supabase
            .from('runs')
            .select('status, started_at')
            .eq('id', runId)
            .single(),
    );

    if (run.status !== 'running') {
        return;
    }

    const queue = await loadQueue(auditId);

    await writeSitePages(
        [...queue.values()]
            .filter((entry) => entry.state !== 'queued')
            .map((entry) => ({
                project_id: projectId,
                url: entry.url,
                inbound_links: entry.inbound_links,
            })),
    );

    const { count, error } = await supabase
        .from('site_pages')
        .select('id', { count: 'exact', head: true })
        .eq('last_audit_id', auditId)
        .eq('is_indexable', true);

    if (error) {
        throw new Error(error.message);
    }

    await writeScore(supabase, {
        projectId,
        auditId,
        hasCrossPageChecks: true,
    });

    const audit = await one(
        supabase
            .from('audits')
            .update({
                pages_indexable: count ?? 0,
                duration_s: Math.round(
                    (Date.now() - Date.parse(run.started_at)) / 1000,
                ),
            })
            .eq('id', auditId)
            .select('is_partial')
            .single(),
    );

    if (
        !audit.is_partial &&
        ![...queue.values()].some((entry) => entry.state === 'queued')
    ) {
        await done(
            supabase
                .from('site_pages')
                .update({ is_gone: true })
                .eq('project_id', projectId)
                .or(`last_audit_id.is.null,last_audit_id.neq.${auditId}`),
        );
    }

    await sweepAudits(projectId, auditId);

    await markProgress(runId);
    await finishRun(runId);
}

type Site = Awaited<ReturnType<typeof loadSite>>;

async function loadSite(projectId: string) {
    const supabase = createAdminClient();

    const [project, locales] = await Promise.all([
        one(
            supabase
                .from('projects')
                .select('domain, obey_robots, bot_secret')
                .eq('id', projectId)
                .single(),
        ),
        one(
            supabase
                .from('project_locales')
                .select('locale, base_url, is_default')
                .eq('project_id', projectId)
                .order('is_default', { ascending: false }),
        ),
    ]);

    const baseUrls = siteBaseUrls(project.domain, locales);

    return {
        locales,
        obeyRobots: project.obey_robots,
        access: {
            botSecret: project.bot_secret,
            hosts: siteHosts(project.domain, baseUrls),
        },
        homes: homePages(baseUrls),
        origins: [...new Set(baseUrls.map((url) => new URL(url).origin))],
    };
}

async function loadQueue(auditId: string) {
    const supabase = createAdminClient();

    const entries: QueueEntry[] = await all((from, to) =>
        supabase
            .from('audit_queue')
            .select('url, depth, state, in_sitemap, inbound_links')
            .eq('audit_id', auditId)
            .order('url')
            .range(from, to),
    );

    return new Map(entries.map((entry) => [entry.url, entry]));
}

async function writeQueue(auditId: string, entries: QueueEntry[]) {
    if (entries.length === 0) {
        return;
    }

    await done(
        createAdminClient()
            .from('audit_queue')
            .upsert(
                entries.map((entry) => ({ audit_id: auditId, ...entry })),
                { onConflict: 'audit_id,url' },
            ),
    );
}

async function writeFindings(rows: TablesInsert<'audit_findings'>[]) {
    for (let start = 0; start < rows.length; start += rowsPerWrite) {
        await done(
            createAdminClient()
                .from('audit_findings')
                .insert(rows.slice(start, start + rowsPerWrite)),
        );
    }
}

async function sweepAudits(projectId: string, auditId: string) {
    const supabase = createAdminClient();

    const audits = await one(
        supabase
            .from('audits')
            .select('id, runs(status)')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false }),
    );

    const previous = audits.find(
        (audit) => audit.id !== auditId && audit.runs?.status !== 'running',
    );

    const older = audits
        .map((audit) => audit.id)
        .filter((id) => id !== auditId && id !== previous?.id);

    await done(
        supabase
            .from('audit_queue')
            .delete()
            .in(
                'audit_id',
                audits.map((audit) => audit.id),
            ),
    );

    if (older.length === 0) {
        return;
    }

    for (const table of [
        'audit_check_results',
        'audit_findings',
        'audit_renders',
    ] as const) {
        await done(supabase.from(table).delete().in('audit_id', older));
    }
}

async function loadPageIds(projectId: string, locales: Site['locales']) {
    const pages = await one(
        createAdminClient()
            .from('pages')
            .select('id, slug, locale, page_kinds(url_prefix)')
            .eq('project_id', projectId)
            .eq('status', 'published'),
    );

    return new Map(
        pages.flatMap((page) => {
            const locale = locales.find(
                (candidate) => candidate.locale === page.locale,
            );

            return locale
                ? [
                      [
                          pagePath(
                              locale.base_url,
                              page.page_kinds?.url_prefix ?? '',
                              page.slug,
                          ),
                          page.id,
                      ] as const,
                  ]
                : [];
        }),
    );
}

async function readBatch(
    client: SiteClient,
    batch: QueueEntry[],
    isBlocked: (url: string) => boolean,
) {
    const pending = [...batch];
    const reads: Read[] = [];

    await Promise.all(
        Array.from({ length: requestsInFlight }, async () => {
            for (
                let entry = pending.shift();
                entry && !hasStopped(client.pace());
                entry = pending.shift()
            ) {
                if (isBlocked(entry.url)) {
                    reads.push({ entry, outcome: 'blocked' });

                    continue;
                }

                const outcome = await client.read(entry.url);

                if (outcome === null) {
                    return;
                }

                reads.push({ entry, outcome });
            }
        }),
    );

    return reads;
}

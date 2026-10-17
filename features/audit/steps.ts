import { FatalError } from 'workflow';

import { type SiteClient, siteClient } from '@/features/audit/client';
import { observeRead, type Read } from '@/features/audit/observe';
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
    linkTarget,
    nextBatch,
    type QueueEntry,
    siteHosts,
    siteOrigins,
} from '@/features/audit/queue';
import {
    blockedBy,
    type RobotsFile,
    robotsFile,
} from '@/features/audit/robots';
import { writeSitePages } from '@/features/audit/site-pages';
import { readSitemaps } from '@/features/audit/sitemaps';
import { pagePath } from '@/features/pages/draft';
import { finishRun, markProgress } from '@/features/runs/steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { done, one } from '@/lib/supabase/result';
import type { Json } from '@/lib/types/database';

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

        files.push(robotsFile(url, fetched instanceof Error ? null : fetched));
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

    // TODO: the robots and sitemap checks run here, on files and sitemaps;
    // backlog 2026-10-17, the rest of audit slice 1.

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

    // TODO: the page checks run here, on reads and observed; backlog
    // 2026-10-17, the rest of audit slice 1.

    await writeSitePages(
        observed.map(({ row }) => ({
            ...row,
            inbound_links: next.get(row.url)!.inbound_links,
        })),
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

    // TODO: the site checks, the score, is_gone and the retention sweep run
    // here; backlog 2026-10-17, the rest of audit slice 1.

    await done(
        supabase
            .from('audits')
            .update({
                pages_indexable: count ?? 0,
                duration_s: Math.round(
                    (Date.now() - Date.parse(run.started_at)) / 1000,
                ),
            })
            .eq('id', auditId),
    );

    await done(supabase.from('audit_queue').delete().eq('audit_id', auditId));

    await markProgress(runId);
    await finishRun(runId);
}

type Site = Awaited<ReturnType<typeof loadSite>>;

const rowsPerRead = 1_000;

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

    const baseUrls =
        locales.length > 0
            ? locales.map((locale) => locale.base_url)
            : [`https://${project.domain}`];

    return {
        locales,
        obeyRobots: project.obey_robots,
        access: {
            botSecret: project.bot_secret,
            hosts: siteHosts(project.domain, baseUrls),
        },
        homes: [...new Set(baseUrls.map((url) => new URL(url).href))],
        origins: [...new Set(baseUrls.map((url) => new URL(url).origin))],
    };
}

async function loadQueue(auditId: string) {
    const supabase = createAdminClient();
    const entries: QueueEntry[] = [];

    for (let from = 0; ; from += rowsPerRead) {
        const rows = await one(
            supabase
                .from('audit_queue')
                .select('url, depth, state, in_sitemap, inbound_links')
                .eq('audit_id', auditId)
                .order('url')
                .range(from, from + rowsPerRead - 1),
        );

        entries.push(...rows);

        if (rows.length < rowsPerRead) {
            return new Map(entries.map((entry) => [entry.url, entry]));
        }
    }
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

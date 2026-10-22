import { FatalError } from 'workflow';

import {
    type ForeignClient,
    foreignClient,
    type SiteClient,
    siteClient,
} from '@/features/audit/client';
import { runCdnTest } from '@/features/audit/cdn-test';
import { previousAudit } from '@/features/audit/changes';
import { type Finding, findingRows } from '@/features/audit/finding';
import { checkMarkdown } from '@/features/audit/markdown-checks';
import { judgeMobile } from '@/features/audit/mobile-checks';
import {
    observeRead,
    type Read,
    storedAlternates,
} from '@/features/audit/observe';
import { checkPage } from '@/features/audit/page-checks';
import {
    assetWeightChecks,
    isHtmlAnswer,
    isSlowRead,
} from '@/features/audit/performance-checks';
import {
    firstPace,
    hasStopped,
    type Pace,
    requestsInFlight,
    stepBudgetMs,
    stoppedAnswering,
} from '@/features/audit/pacing';
import {
    contentPaths,
    hostVariants,
    judgeHttpTwin,
    judgeMissingPath,
    judgeStaging,
    judgeVariant,
    type LinkedHosts,
    linkedHosts,
    randomPathTargets,
    randomPathToken,
    stagingHosts,
} from '@/features/audit/probes';
import {
    addToQueue,
    batchSize,
    homePages,
    linkTarget,
    nextBatch,
    type QueueEntry,
    siteBaseUrls,
    siteHosts,
    siteOrigins,
} from '@/features/audit/queue';
import {
    agentsBlocked,
    aiSearchAgents,
    blockedBy,
    cdnTestAgents,
    googlebotBlocks,
    namedSitemaps,
    type RobotsFile,
    robotsFile,
} from '@/features/audit/robots';
import {
    addResources,
    answerOf,
    askResource,
    type Frontier,
    isForeignResource,
    isSampledAsset,
    judgeResource,
    refusals,
    refusedAnswer,
    refusedHosts,
    type Resource,
    type ResourceAnswer,
} from '@/features/audit/resources';
import { robotsChecks } from '@/features/audit/robots-checks';
import { variantSample } from '@/features/audit/sample';
import {
    crossPageChecks,
    resourceChecks,
    scoredPageColumns,
} from '@/features/audit/score';
import { isShellSite } from '@/features/audit/shell';
import { siteChecks, siteHalves } from '@/features/audit/site-checks';
import { rowsPerWrite, writeSitePages } from '@/features/audit/site-pages';
import { sitemapChecks } from '@/features/audit/sitemap-checks';
import { readSitemaps } from '@/features/audit/sitemaps';
import { writeScore } from '@/features/audit/write-score';
import { type Fetched, phoneHeaders } from '@/features/crawl/fetch';
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

    const named = namedSitemaps(files);

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
                ...sitemapChecks(sitemaps, { robots: files, now: Date.now() }),
            ],
            { projectId, auditId, pageIds: new Map() },
        ),
    );

    const { queue, isCapped } = addToQueue(new Map(), [
        ...site.homes.map((url) => ({ url, depth: 0 })),
        ...sitemaps
            .flatMap((file) => file.sitemap.urls)
            .flatMap(({ loc, alternates }) => {
                const url = linkTarget(loc, site.access.hosts);

                return url
                    ? [
                          {
                              url,
                              depth: null,
                              inSitemap: true,
                              ...(alternates.length > 0 && { alternates }),
                          },
                          ...alternates.flatMap(({ href }) => {
                              const target = linkTarget(
                                  href,
                                  site.access.hosts,
                              );

                              return target && target !== url
                                  ? [{ url: target, depth: null }]
                                  : [];
                          }),
                      ]
                    : [];
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
                    'robots_rules, linked_hosts, request_count, host_429_count, host_5xx_count',
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

    const reads = (
        await readBatch(client, batch, blockedBy(files, site.obeyRobots))
    ).sort((a, b) => batch.indexOf(a.entry) - batch.indexOf(b.entry));

    const pageIds = await loadPageIds(projectId);

    const observed = reads.map((read) =>
        observeRead(read, {
            projectId,
            auditId,
            locales: site.locales,
            hosts: site.access.hosts,
            domain: site.domain,
            pageIds,
        }),
    );

    const added = addToQueue(
        queue,
        observed.flatMap((page) => page.candidates),
    );

    const resources = addResources(
        await loadResources(auditId),
        observed.flatMap((page) => page.resources),
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
        aiSearchBlocked: agentsBlocked(files, aiSearchAgents),
        locales: site.locales,
        hosts: site.access.hosts,
        homes: site.homes,
        projectName: site.name,
        domain: site.domain,
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

    await writeResources(
        auditId,
        resources.touched.map((url) => resources.frontier.get(url)!),
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
                linked_hosts: linkedHosts(
                    (audit.linked_hosts ?? {}) as LinkedHosts,
                    observed.flatMap(({ page }) => page?.links ?? []),
                    site.access.hosts,
                ),
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

export async function checkResources(
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

    const [site, audit, batch, refused, pages] = await Promise.all([
        loadSite(projectId),
        one(
            supabase
                .from('audits')
                .select('request_count, host_429_count, host_5xx_count')
                .eq('id', auditId)
                .single(),
        ),
        one(
            supabase
                .from('audit_resources')
                .select(resourceColumns)
                .eq('audit_id', auditId)
                .eq('state', 'queued')
                // Postgres orders an enum by its declaration order, image,
                // og_image, jsonld_image, asset, external in the migrations:
                // images first.
                .order('kind')
                .order('url')
                .limit(batchSize),
        ),
        all((from, to) =>
            supabase
                .from('audit_resources')
                .select('url, kind, status_code')
                .eq('audit_id', auditId)
                .eq('state', 'checked')
                .in('status_code', [...refusals])
                .order('url')
                .range(from, to),
        ),
        all((from, to) =>
            supabase
                .from('site_pages')
                .select('id, url, is_indexable, status_code, redirect_to')
                .eq('last_audit_id', auditId)
                .order('url')
                .range(from, to),
        ),
    ]);

    if (batch.length === 0) {
        return { hasWork: false, pace };
    }

    const deadline = Date.now() + stepBudgetMs;
    const client = siteClient({ ...site.access, pace, deadline });
    const foreign = foreignClient({ deadline });

    const isForeign = (row: Pick<Resource, 'url' | 'kind'>) =>
        isForeignResource(row, site.access.hosts, site.domain);

    const sample = new Set(
        variantSample(
            pages
                .filter(
                    (page) =>
                        page.is_indexable &&
                        page.status_code === 200 &&
                        page.redirect_to === null,
                )
                .map((page) => page.url),
            site.homes,
        ),
    );

    const answers = await checkBatch(batch, {
        client,
        foreign,
        isForeign,
        refused: refusedHosts(refused, isForeign),
        sample,
    });

    const checked = answers.map(({ row }) => row.url);
    const pageIds = new Map(pages.map((page) => [page.url, page.id]));

    if (checked.length > 0) {
        await done(
            supabase
                .from('audit_findings')
                .delete()
                .eq('audit_id', auditId)
                .in('check', resourceChecks)
                .in('subject', checked),
        );

        await done(
            supabase
                .from('audit_findings')
                .delete()
                .eq('audit_id', auditId)
                .eq('check', 'og-image-bad')
                .contains('detail', { reason: 'image' })
                .in('subject', checked),
        );
    }

    await writeFindings(
        findingRows(
            answers
                .flatMap(({ row, answer }) =>
                    answer
                        ? judgeResource(row, answer, isForeign(row), sample)
                        : [],
                )
                .filter((finding) => pageIds.has(finding.url!)),
            { projectId, auditId, pageIds },
        ),
    );

    await writeResources(
        auditId,
        answers.map(({ row, answer }) => ({
            ...row,
            state: 'checked',
            status_code: answer?.status ?? null,
            content_length: answer?.contentLength ?? null,
            error: answer?.error ?? null,
        })),
    );

    await done(
        supabase
            .from('audits')
            .update({
                request_count:
                    audit.request_count +
                    client.counts.requests +
                    foreign.counts.requests,
                host_429_count: audit.host_429_count + client.counts.tooMany,
                host_5xx_count:
                    audit.host_5xx_count + client.counts.serverErrors,
            })
            .eq('id', auditId),
    );

    await markProgress(runId);

    if (hasStopped(client.pace())) {
        throw new FatalError(stoppedAnswering);
    }

    return {
        hasWork: batch.length === batchSize || answers.length < batch.length,
        pace: client.pace(),
    };
}

export async function probeSite(
    projectId: string,
    runId: string,
    auditId: string,
    pace: Pace,
) {
    'use step';

    const supabase = createAdminClient();

    const run = await one(
        supabase.from('runs').select('status').eq('id', runId).single(),
    );

    if (run.status !== 'running') {
        return;
    }

    const [site, audit, queue, pages] = await Promise.all([
        loadSite(projectId),
        one(
            supabase
                .from('audits')
                .select(
                    'robots_rules, linked_hosts, request_count, host_429_count, host_5xx_count',
                )
                .eq('id', auditId)
                .single(),
        ),
        loadQueue(auditId),
        all((from, to) =>
            supabase
                .from('site_pages')
                .select('id, url')
                .eq('last_audit_id', auditId)
                .eq('is_indexable', true)
                .eq('status_code', 200)
                .is('redirect_to', null)
                .order('url')
                .range(from, to),
        ),
    ]);

    const client = siteClient({
        ...site.access,
        pace,
        deadline: Date.now() + stepBudgetMs,
    });

    await done(
        supabase
            .from('audit_findings')
            .delete()
            .eq('audit_id', auditId)
            .in('check', [
                'soft-404',
                'redirect-to-home',
                'staging-indexable',
                'ai-cdn-blocked',
                'pay-per-crawl',
                'markdown-alternate',
            ])
            .is('site_page_id', null),
    );

    await done(
        supabase
            .from('audit_findings')
            .delete()
            .eq('audit_id', auditId)
            .in('check', ['host-variants', 'mobile-content-differs']),
    );

    await done(
        supabase
            .from('audit_findings')
            .delete()
            .eq('audit_id', auditId)
            .eq('check', 'https-missing')
            .contains('detail', { reason: 'no-redirect' }),
    );

    await done(
        supabase
            .from('audit_findings')
            .delete()
            .eq('audit_id', auditId)
            .eq('check', 'robots-googlebot-blocked')
            .contains('detail', { reason: 'content-paths' }),
    );

    const files = (audit.robots_rules ?? []) as unknown as RobotsFile[];
    const isBlocked = blockedBy(files, site.obeyRobots);
    const [home] = site.homes;

    const cdn = isBlocked(home)
        ? { outcome: null, findings: [] }
        : await runCdnTest(
              home,
              (agent) =>
                  client.readWithoutSecret(home, {
                      headers: { 'user-agent': agent },
                  }),
              agentsBlocked(
                  files,
                  cdnTestAgents.map(({ agent }) => agent),
              )(home),
          );

    const markdown = await checkMarkdown(home, client.read, isBlocked);

    const sample = variantSample(
        pages.map((page) => page.url),
        site.homes,
    );

    const probes: Probe[] = [
        ...randomPathTargets(
            site.access.hosts,
            site.homes,
            randomPathToken(),
        ).map(({ base, url }) => ({
            url,
            method: 'GET' as const,
            judge: (fetched: Fetched) =>
                judgeMissingPath(fetched, base, site.homes, site.access.hosts),
        })),
        ...sample.flatMap((url) =>
            hostVariants(url).map((variant) => ({
                url: variant.url,
                method: 'GET' as const,
                judge: (fetched: Fetched) =>
                    variant.variant === 'http'
                        ? judgeHttpTwin(url, fetched)
                        : judgeVariant(url, variant, fetched),
            })),
        ),
        ...sample.flatMap((url) => {
            let desktop: Fetched | undefined;

            return [
                {
                    url,
                    method: 'GET' as const,
                    judge: (fetched: Fetched) => {
                        desktop = fetched;

                        return null;
                    },
                },
                {
                    url,
                    method: 'GET' as const,
                    headers: phoneHeaders,
                    judge: (phone: Fetched) =>
                        desktop
                            ? judgeMobile(
                                  url,
                                  desktop,
                                  phone,
                                  site.access.hosts,
                              )
                            : null,
                },
            ];
        }),
        ...stagingHosts(
            (audit.linked_hosts ?? {}) as LinkedHosts,
            site.domain,
        ).map(([host, url]) => ({
            url,
            method: 'GET' as const,
            judge: (fetched: Fetched) => judgeStaging(host, url, fetched),
        })),
    ];

    const findings = [
        contentPaths(queue.values(), googlebotBlocks(files)),
        ...cdn.findings,
        markdown,
    ];

    for (const probe of probes.filter(({ url }) => !isBlocked(url))) {
        if (hasStopped(client.pace())) {
            break;
        }

        const fetched = await client.read(probe.url, {
            method: probe.method,
            headers: probe.headers,
        });

        if (fetched === null) {
            break;
        }

        findings.push(fetched instanceof Error ? null : probe.judge(fetched));
    }

    await writeFindings(
        findingRows(
            findings.filter((finding) => finding !== null),
            {
                projectId,
                auditId,
                pageIds: new Map(pages.map((page) => [page.url, page.id])),
            },
        ),
    );

    await done(
        supabase
            .from('audits')
            .update({
                request_count: audit.request_count + client.counts.requests,
                host_429_count: audit.host_429_count + client.counts.tooMany,
                host_5xx_count:
                    audit.host_5xx_count + client.counts.serverErrors,
                cdn_test: cdn.outcome,
            })
            .eq('id', auditId),
    );

    await markProgress(runId);

    if (hasStopped(client.pace())) {
        throw new FatalError(stoppedAnswering);
    }
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

    const [site, audit, rows, assets] = await Promise.all([
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
                    `${scoredPageColumns}, body_hash, body_simhash, title, description, click_depth, inbound_links, hreflang, has_microdata` as const,
                )
                .eq('last_audit_id', auditId)
                .order('id')
                .range(from, to),
        ),
        all((from, to) =>
            supabase
                .from('audit_resources')
                .select('linked_from, content_length')
                .eq('audit_id', auditId)
                .eq('kind', 'asset')
                .eq('status_code', 200)
                .order('url')
                .range(from, to),
        ),
    ]);

    const files = (audit.robots_rules ?? []) as unknown as RobotsFile[];

    const findings = [
        ...siteChecks(rows, {
            homes: site.homes,
            hosts: site.access.hosts,
            isDisallowed: googlebotBlocks(files),
            isHttpsSite: site.homes.some((home) => home.startsWith('https:')),
            linkedFrom: new Map(
                [...queue.values()].map((entry) => [
                    entry.url,
                    entry.linked_from,
                ]),
            ),
            sitemapAlternates: new Map(
                [...queue.values()].map((entry) => [
                    entry.url,
                    storedAlternates(entry.alternates),
                ]),
            ),
        }),
        ...assetWeightChecks(site.homes, assets),
    ];

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

    const [queue, site, pages] = await Promise.all([
        loadQueue(auditId),
        loadSite(projectId),
        all((from, to) =>
            supabase
                .from('site_pages')
                .select('url, status_code, redirect_to, is_shell')
                .eq('last_audit_id', auditId)
                .order('url')
                .range(from, to),
        ),
    ]);

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
                is_shell: isShellSite(pages, site.homes),
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

interface Probe {
    url: string;
    method: 'GET' | 'HEAD';
    headers?: Record<string, string>;
    judge: (fetched: Fetched) => Finding | null;
}

async function loadSite(projectId: string) {
    const supabase = createAdminClient();

    const [project, locales] = await Promise.all([
        one(
            supabase
                .from('projects')
                .select('name, domain, obey_robots, bot_secret')
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
        name: project.name,
        domain: project.domain,
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
            .select(
                'url, depth, state, in_sitemap, inbound_links, linked_from, alternates',
            )
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

const resourceColumns =
    'url, kind, linked_from, link_count, state, status_code, content_length, error';

async function loadResources(auditId: string): Promise<Frontier> {
    const rows: Resource[] = await all((from, to) =>
        createAdminClient()
            .from('audit_resources')
            .select(resourceColumns)
            .eq('audit_id', auditId)
            .order('url')
            .range(from, to),
    );

    return new Map(rows.map((row) => [row.url, row]));
}

async function writeResources(auditId: string, rows: Resource[]) {
    for (let start = 0; start < rows.length; start += rowsPerWrite) {
        await done(
            createAdminClient()
                .from('audit_resources')
                .upsert(
                    rows
                        .slice(start, start + rowsPerWrite)
                        .map((row) => ({ audit_id: auditId, ...row })),
                    { onConflict: 'audit_id,url' },
                ),
        );
    }
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

    const previous = previousAudit(
        audits.flatMap(({ runs, ...audit }) =>
            audit.id === auditId ? [] : [{ run: runs, audit }],
        ),
    );

    const older = audits
        .map((audit) => audit.id)
        .filter((id) => id !== auditId && id !== previous?.id);

    for (const frontier of ['audit_queue', 'audit_resources'] as const) {
        await done(
            supabase
                .from(frontier)
                .delete()
                .in(
                    'audit_id',
                    audits.map((audit) => audit.id),
                ),
        );
    }

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

async function loadPageIds(projectId: string) {
    const pages = await one(
        createAdminClient()
            .from('published_pages')
            .select('page_id, url, pages!inner(status)')
            .eq('project_id', projectId)
            .eq('pages.status', 'published'),
    );

    return new Map(pages.map((page) => [page.url, page.page_id]));
}

interface ResourceCheck {
    client: SiteClient;
    foreign: ForeignClient;
    isForeign: (row: Resource) => boolean;
    refused: Map<string, number>;
    sample: ReadonlySet<string>;
}

async function checkBatch(
    batch: Resource[],
    { client, foreign, isForeign, refused, sample }: ResourceCheck,
) {
    const pending = [...batch];
    const busy = new Set<string>();
    const answers: { row: Resource; answer: ResourceAnswer | null }[] = [];

    const hostOf = (row: Resource) =>
        isForeign(row) ? new URL(row.url).hostname : null;

    const take = () => {
        const index = pending.findIndex((row) => {
            const host = hostOf(row);

            return host === null || !busy.has(host);
        });

        return index === -1 ? undefined : pending.splice(index, 1)[0];
    };

    await Promise.all(
        Array.from({ length: requestsInFlight }, async () => {
            for (
                let row = take();
                row && !hasStopped(client.pace());
                row = take()
            ) {
                const host = hostOf(row);
                const refusal = host === null ? undefined : refused.get(host);

                if (!isSampledAsset(row, sample)) {
                    answers.push({ row, answer: null });

                    continue;
                }

                if (refusal !== undefined) {
                    answers.push({ row, answer: refusedAnswer(refusal) });

                    continue;
                }

                if (host !== null) {
                    busy.add(host);
                }

                const outcome = await askResource(
                    host === null ? client.read : foreign.read,
                    row.url,
                );

                if (host !== null) {
                    busy.delete(host);
                }

                if (outcome === null) {
                    return;
                }

                const answer = answerOf(outcome);

                if (
                    host !== null &&
                    answer.status !== null &&
                    refusals.has(answer.status)
                ) {
                    refused.set(host, answer.status);
                }

                answers.push({ row, answer });
            }
        }),
    );

    return answers;
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

                const second =
                    outcome instanceof Error || !isSlowRead(outcome)
                        ? null
                        : await client.read(entry.url);

                reads.push({
                    entry,
                    outcome,
                    ...(second &&
                        !(second instanceof Error) &&
                        isHtmlAnswer(second) && {
                            secondReadMs: second.headersMs,
                        }),
                });
            }
        }),
    );

    return reads;
}

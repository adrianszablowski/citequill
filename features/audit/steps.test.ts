import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { foreignClient, siteClient } from '@/features/audit/client';
import {
    firstPace,
    type Pace,
    stoppedAnswering,
} from '@/features/audit/pacing';
import type { QueueEntry } from '@/features/audit/queue';
import {
    cdnTestAgents,
    type RobotsFile,
    robotsFile,
} from '@/features/audit/robots';
import { resourceChecks } from '@/features/audit/score';
import {
    checkResources,
    checkSite,
    closeAudit,
    discoverSite,
    probeSite,
    readPages,
} from '@/features/audit/steps';
import { markdownAccept } from '@/features/audit/markdown-checks';
import {
    bingbotUserAgent,
    botSecretHeader,
    desktopUserAgent,
    type Fetched,
    googlebotUserAgent,
    phoneHeaders,
    userAgent,
} from '@/features/crawl/fetch';
import { finishRun, markProgress } from '@/features/runs/steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { type FakeQuery, fakeSupabase } from '@/lib/supabase/fake';
import { rowsPerRead } from '@/lib/supabase/result';
import { Constants } from '@/lib/types/database';

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

vi.mock('@/features/runs/steps', () => {
    return { finishRun: vi.fn(async () => {}), markProgress: vi.fn() };
});

vi.mock('@/features/audit/client', () => {
    return { siteClient: vi.fn(), foreignClient: vi.fn() };
});

const startedAt = '2026-10-17T10:00:00Z';

interface Setup {
    runStatus?: string;
    queue?: QueueEntry[];
    isPartial?: boolean;
    sitePages?: object[];
    linkedHosts?: object | null;
    robotsRules?: RobotsFile[];
    obeyRobots?: boolean;
    audits?: object[];
    resources?: Record<string, unknown>[];
    livePages?: object[];
}

function database({
    runStatus = 'running',
    queue = [],
    isPartial = false,
    sitePages = [],
    linkedHosts = null,
    robotsRules = [],
    obeyRobots = true,
    audits = [
        { id: 'audit', runs: { status: 'running' } },
        { id: 'stopped', runs: { status: 'failed' } },
        { id: 'older', runs: { status: 'finished' } },
    ],
    resources = [],
    livePages = [],
}: Setup = {}) {
    const answers: Record<string, (query: FakeQuery) => object> = {
        runs: () => ({ data: { status: runStatus, started_at: startedAt } }),
        projects: () => ({
            data: {
                name: 'Acme',
                domain: 'acme.com',
                obey_robots: obeyRobots,
                bot_secret: 's',
            },
        }),
        project_locales: () => ({
            data: [
                {
                    locale: 'en',
                    base_url: 'https://acme.com',
                    is_default: true,
                },
                {
                    locale: 'de',
                    base_url: 'https://acme.de',
                    is_default: false,
                },
            ],
        }),
        audit_queue: () => ({ data: queue }),
        audit_resources: ({ calls }) =>
            calls[0][0] === 'select'
                ? { data: selected(resources, calls) }
                : {},
        audits: ({ calls }) => {
            if (calls[0][0] === 'update') {
                return { data: { is_partial: isPartial } };
            }

            return String(calls[0][1]).includes('runs')
                ? { data: audits }
                : {
                      data: {
                          robots_rules: robotsRules,
                          linked_hosts: linkedHosts,
                          request_count: 3,
                          host_429_count: 1,
                          host_5xx_count: 2,
                      },
                  };
        },
        site_pages: ({ calls }) => {
            if (calls[0][0] === 'upsert') {
                const rows = calls[0][1] as { url: string }[];

                return {
                    data: rows.map(({ url }) => ({ id: `id of ${url}`, url })),
                };
            }

            return calls[0][2] ? { count: 0 } : { data: sitePages };
        },
        published_pages: () => ({ data: livePages }),
        audit_findings: () => ({ data: [] }),
        audit_marks: () => ({ data: [] }),
    };

    const fake = fakeSupabase((query) => answers[query.name]?.(query) ?? {});

    vi.mocked(createAdminClient).mockReturnValue(fake.client as never);

    return fake;
}

function answering(
    read: (
        url: string,
        options?: {
            method?: 'GET' | 'HEAD';
            headers?: Record<string, string>;
        },
    ) => Promise<Fetched | Error | null>,
    pace = firstPace,
) {
    const client = {
        read: vi.fn(read),
        readWithoutSecret: vi.fn(read),
        counts: { requests: 0, tooMany: 0, serverErrors: 0 },
        pace: () => pace,
    };

    vi.mocked(siteClient).mockReturnValue(client);

    return client;
}

function abroad(
    read: (
        url: string,
        options?: { method?: 'GET' | 'HEAD' },
    ) => Promise<Fetched | Error | null>,
) {
    const client = { read: vi.fn(read), counts: { requests: 0 } };

    vi.mocked(foreignClient).mockReturnValue(client);

    return client;
}

function notFound(url: string): Fetched {
    return {
        ok: false,
        status: 404,
        url,
        headers: new Headers(),
        body: '',
        bytes: 0,
        isUtf8: true,
        isTruncated: false,
        hops: [{ url, status: 404 }],
        headersMs: 0,
    };
}

function answered(hops: { url: string; status: number }[], body = ''): Fetched {
    const last = hops.at(-1)!;

    return {
        ok: last.status < 400,
        status: last.status,
        url: last.url,
        headers: new Headers(),
        body,
        bytes: 0,
        isUtf8: true,
        isTruncated: false,
        hops,
        headersMs: 0,
    };
}

function inserted(fake: ReturnType<typeof database>, table: string) {
    return fake.queries
        .filter(({ name }) => name === table)
        .flatMap(({ calls }) => calls.filter(([method]) => method === 'insert'))
        .flatMap(([, rows]) => rows as Record<string, unknown>[]);
}

function call(
    fake: ReturnType<typeof database>,
    table: string,
    method: string,
) {
    return fake.queries.filter(
        ({ name, calls }) => name === table && calls[0][0] === method,
    );
}

function filters(query: FakeQuery) {
    return Object.fromEntries(
        query.calls
            .filter(([method]) => method !== 'delete')
            .map(([method, column, value]) => [
                `${method} ${String(column)}`,
                value,
            ]),
    );
}

const kindOrder: readonly string[] = Constants.public.Enums.audit_resource_kind;

function selected(rows: Record<string, unknown>[], calls: FakeQuery['calls']) {
    const orders: string[] = [];
    let result = [...rows];

    for (const [method, column, value] of calls) {
        const key = String(column);

        if (method === 'eq' && key !== 'audit_id') {
            result = result.filter((row) => row[key] === value);
        }

        if (method === 'in') {
            result = result.filter((row) =>
                (value as unknown[]).includes(row[key]),
            );
        }

        if (method === 'order') {
            orders.push(key);
        }
    }

    const rank = (row: Record<string, unknown>, key: string) =>
        key === 'kind' ? kindOrder.indexOf(String(row.kind)) : String(row[key]);

    result.sort((a, b) => {
        for (const key of orders) {
            if (rank(a, key) !== rank(b, key)) {
                return rank(a, key) < rank(b, key) ? -1 : 1;
            }
        }

        return 0;
    });

    const [, limit] = calls.find(([method]) => method === 'limit') ?? [];
    const [, from, to] = calls.find(([method]) => method === 'range') ?? [];

    return result.slice(
        (from as number | undefined) ?? 0,
        to === undefined ? (limit as number | undefined) : Number(to) + 1,
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('discoverSite', () => {
    it('reads robots.txt once from every origin the queue admits, each host and its twin over https and http', async () => {
        database();

        const client = answering(async (url) => notFound(url));

        await discoverSite('project', 'run', 'audit');

        expect(
            client.read.mock.calls
                .map(([url]) => url)
                .filter((url) => url.endsWith('/robots.txt')),
        ).toEqual(
            [
                'https://acme.com',
                'https://www.acme.com',
                'https://acme.de',
                'https://www.acme.de',
                'http://acme.com',
                'http://www.acme.com',
                'http://acme.de',
                'http://www.acme.de',
            ].map((origin) => `${origin}/robots.txt`),
        );
    });

    it("replaces the audit's site-level findings with what robots.txt and the sitemaps show", async () => {
        const fake = database();

        answering(async (url) => notFound(url));

        await discoverSite('project', 'run', 'audit');

        expect(call(fake, 'audit_findings', 'delete')[0].calls).toEqual([
            ['delete'],
            ['eq', 'audit_id', 'audit'],
            ['is', 'site_page_id', null],
        ]);

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.subject ?? null,
                row.site_page_id,
            ]),
        ).toEqual([
            ['robots-4xx', 'https://acme.com/robots.txt', null],
            ['robots-4xx', 'https://acme.de/robots.txt', null],
            ['sitemap-not-in-robots', null, null],
            ['sitemap-missing', null, null],
        ]);
    });

    it('records no robots.txt and no finding for an origin it had no time left to ask', async () => {
        const unasked = 'https://acme.de/robots.txt';
        const fake = database();

        answering(async (url) => (url === unasked ? null : notFound(url)));

        await discoverSite('project', 'run', 'audit');

        expect(
            inserted(fake, 'audit_findings')
                .filter(({ check }) => String(check).startsWith('robots-'))
                .map((row) => [row.check, row.subject]),
        ).toEqual([['robots-4xx', 'https://acme.com/robots.txt']]);

        const [, update] = call(fake, 'audits', 'update')[0].calls[0] as [
            string,
            { robots_rules: { url: string }[] },
        ];

        expect(update.robots_rules.map(({ url }) => url)).not.toContain(
            unasked,
        );

        expect(update.robots_rules).toHaveLength(7);
    });

    it('still reports a robots.txt that gave no answer at all', async () => {
        const failed = 'https://acme.de/robots.txt';
        const fake = database();

        answering(async (url) =>
            url === failed ? new Error('timed out') : notFound(url),
        );

        await discoverSite('project', 'run', 'audit');

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.subject,
            ]),
        ).toContainEqual(['robots-5xx', failed]);
    });

    it("keeps a sitemap entry's hreflang children on its queue entry, and queues each alternate on the site's hosts without a click depth", async () => {
        const fake = database();

        answering(async (url) =>
            url === 'https://acme.com/sitemap.xml'
                ? answered(
                      [{ url, status: 200 }],
                      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>https://acme.com/en</loc>
<xhtml:link rel="alternate" hreflang="en" href="https://acme.com/en"/>
<xhtml:link rel="alternate" hreflang="de" href="https://acme.de/de"/>
<xhtml:link rel="alternate" hreflang="fr" href="https://other.com/fr"/>
</url>
<url><loc>https://acme.com/plain</loc></url>
</urlset>`,
                  )
                : notFound(url),
        );

        await discoverSite('project', 'run', 'audit');

        const rows = call(fake, 'audit_queue', 'upsert')[0].calls[0][1] as {
            url: string;
            depth: number | null;
            in_sitemap: boolean;
            alternates: unknown;
        }[];

        const byUrl = new Map(rows.map((row) => [row.url, row]));

        expect(byUrl.get('https://acme.com/en')).toMatchObject({
            depth: null,
            in_sitemap: true,
            alternates: [
                { lang: 'en', href: 'https://acme.com/en' },
                { lang: 'de', href: 'https://acme.de/de' },
                { lang: 'fr', href: 'https://other.com/fr' },
            ],
        });

        expect(byUrl.get('https://acme.de/de')).toMatchObject({
            depth: null,
            in_sitemap: false,
            inbound_links: 0,
            alternates: null,
        });

        expect(byUrl.get('https://acme.com/plain')?.alternates).toBeNull();
        expect(byUrl.has('https://other.com/fr')).toBe(false);
    });

    it('leaves an audit whose run has ended as it is, without asking the site', async () => {
        const fake = database({ runStatus: 'failed' });

        await discoverSite('project', 'run', 'audit');

        expect(fake.writes()).toEqual([]);
        expect(siteClient).not.toHaveBeenCalled();
        expect(markProgress).not.toHaveBeenCalled();
    });
});

describe('readPages', () => {
    it("writes each page's findings against the site_pages row its read wrote", async () => {
        const url = 'https://acme.com/gone';

        const fake = database({
            queue: [
                {
                    url,
                    depth: 1,
                    state: 'queued',
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [],
                    alternates: null,
                },
            ],
        });

        answering(async (target) => notFound(target));

        await readPages('project', 'run', 'audit', firstPace);

        expect(call(fake, 'audit_findings', 'delete')[0].calls).toContainEqual([
            'in',
            'site_page_id',
            [`id of ${url}`],
        ]);

        expect(inserted(fake, 'audit_findings')).toMatchObject([
            {
                audit_id: 'audit',
                project_id: 'project',
                site_page_id: `id of ${url}`,
                check: 'page-4xx',
                severity: '3',
                detail: { status: 404 },
            },
        ]);

        expect(markProgress).toHaveBeenCalledWith('run');

        expect(call(fake, 'projects', 'select')[0].calls[0][1]).toContain(
            'name',
        );
    });

    it('gives a page the id of the live page published at its URL', async () => {
        const url = 'https://acme.com/blog/deload';

        const fake = database({
            queue: [
                {
                    url,
                    depth: 1,
                    state: 'queued',
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [],
                    alternates: null,
                },
            ],
            livePages: [{ page_id: 'page', url }],
        });

        answering(async (target) => notFound(target));

        await readPages('project', 'run', 'audit', firstPace);

        expect(call(fake, 'site_pages', 'upsert')[0].calls[0][1]).toMatchObject(
            [{ url, page_id: 'page' }],
        );

        expect(call(fake, 'published_pages', 'select')[0].calls).toContainEqual(
            ['eq', 'pages.status', 'published'],
        );
    });
});

describe('readPages, for html-slow', () => {
    const url = 'https://acme.com/slow';

    const queue: QueueEntry[] = [
        {
            url,
            depth: 1,
            state: 'queued',
            in_sitemap: false,
            inbound_links: 1,
            linked_from: [],
            alternates: null,
        },
    ];

    const timed = (headersMs: number, title = 'Slow') => ({
        ...answered([{ url, status: 200 }], `<title>${title}</title>`),
        headersMs,
    });

    it('reads a page over 800 ms a second time and reports it when both reads were slow, with the page row from the first read', async () => {
        vi.stubEnv('VERCEL_REGION', 'fra1');

        const fake = database({ queue });
        const answers = [timed(1200), timed(950, 'Second')];

        const client = answering(async () => answers.shift()!);

        await readPages('project', 'run', 'audit', firstPace);

        expect(client.read.mock.calls.map(([target]) => target)).toEqual([
            url,
            url,
        ]);

        expect(call(fake, 'site_pages', 'upsert')[0].calls[0][1]).toMatchObject(
            [{ url, title: 'Slow', status_code: 200 }],
        );

        expect(
            inserted(fake, 'audit_findings').filter(
                (row) => row.check === 'html-slow',
            ),
        ).toMatchObject([
            {
                site_page_id: `id of ${url}`,
                detail: { ms: [1200, 950], region: 'fra1' },
            },
        ]);
    });

    it('reports nothing when the second read fails, is fast or answers anything but 200 HTML, and never reads a fast page twice', async () => {
        for (const second of [
            new Error('timed out'),
            timed(300),
            { ...answered([{ url, status: 503 }]), headersMs: 900 },
        ]) {
            const fake = database({ queue });
            const answers = [timed(1200), second];

            answering(async () => answers.shift()!);

            await readPages('project', 'run', 'audit', firstPace);

            expect(
                inserted(fake, 'audit_findings').map((row) => row.check),
            ).not.toContain('html-slow');
        }

        database({ queue });

        const client = answering(async () => timed(800));

        await readPages('project', 'run', 'audit', firstPace);

        expect(client.read).toHaveBeenCalledTimes(1);
    });

    it('reports nothing when the budget leaves the second read unsent, and still records the first read', async () => {
        const fake = database({ queue });
        const answers: (Fetched | null)[] = [timed(1200), null];

        answering(async () => answers.shift() ?? null);

        await readPages('project', 'run', 'audit', firstPace);

        expect(call(fake, 'site_pages', 'upsert')[0].calls[0][1]).toMatchObject(
            [{ url, title: 'Slow', status_code: 200 }],
        );

        expect(
            inserted(fake, 'audit_findings').map((row) => row.check),
        ).not.toContain('html-slow');
    });
});

describe('readPages, for the resources', () => {
    it('adds what the page links to into the frontier, with the page as the one linking, before it marks the page read, and never makes the audit partial', async () => {
        const url = 'https://acme.com/about';

        const fake = database({
            queue: [
                {
                    url,
                    depth: 1,
                    state: 'queued',
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [],
                    alternates: null,
                },
            ],
            resources: [
                {
                    url: 'https://acme.com/logo.png',
                    kind: 'image',
                    linked_from: ['https://acme.com/'],
                    link_count: 1,
                    state: 'queued',
                    status_code: null,
                    content_length: null,
                    error: null,
                },
            ],
        });

        answering(async () =>
            answered(
                [{ url, status: 200 }],
                '<img src="/logo.png" alt="Acme"><a href="https://other.com/x">x</a><a href="/team">team</a>',
            ),
        );

        await readPages('project', 'run', 'audit', firstPace);

        const [upsert] = call(fake, 'audit_resources', 'upsert');

        expect(upsert.calls[0][1]).toEqual([
            {
                audit_id: 'audit',
                url: 'https://acme.com/logo.png',
                kind: 'image',
                linked_from: ['https://acme.com/', url],
                link_count: 2,
                state: 'queued',
                status_code: null,
                content_length: null,
                error: null,
            },
            {
                audit_id: 'audit',
                url: 'https://other.com/x',
                kind: 'external',
                linked_from: [url],
                link_count: 1,
                state: 'queued',
                status_code: null,
                content_length: null,
                error: null,
            },
        ]);

        const [queueUpsert] = call(fake, 'audit_queue', 'upsert');

        expect(fake.queries.indexOf(upsert)).toBeLessThan(
            fake.queries.indexOf(queueUpsert),
        );

        expect(queueUpsert.calls[0][1]).toContainEqual(
            expect.objectContaining({
                url: 'https://acme.com/team',
                linked_from: [url],
            }),
        );

        expect(
            call(fake, 'audits', 'update')[0].calls[0][1],
        ).not.toHaveProperty('is_partial');
    });
});

describe('readPages, in read order', () => {
    it('keeps the pages linking to a URL in the order of the batch, whatever order the answers came in', async () => {
        const pages = ['https://acme.com/a', 'https://acme.com/b'];

        async function linkedFrom(slow: string) {
            const fake = database({
                queue: pages.map((url) => ({
                    url,
                    depth: 1,
                    state: 'queued' as const,
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [],
                    alternates: null,
                })),
            });

            answering(async (url) => {
                await new Promise((resolve) =>
                    setTimeout(resolve, url === slow ? 10 : 0),
                );

                return answered(
                    [{ url, status: 200 }],
                    '<a href="/t">t</a><a href="https://other.com/x">x</a>',
                );
            });

            await readPages('project', 'run', 'audit', firstPace);

            return ['audit_queue', 'audit_resources'].map(
                (table) =>
                    (
                        call(fake, table, 'upsert')[0].calls[0][1] as {
                            url: string;
                            linked_from: string[];
                        }[]
                    ).find(
                        ({ url }) =>
                            url === 'https://acme.com/t' ||
                            url === 'https://other.com/x',
                    )!.linked_from,
            );
        }

        expect(await linkedFrom(pages[0])).toEqual([pages, pages]);
        expect(await linkedFrom(pages[1])).toEqual([pages, pages]);
    });
});

describe('readPages, for the probes', () => {
    it('adds the first linked URL of each foreign host to the hosts the audit already holds', async () => {
        const url = 'https://acme.com/about';

        const fake = database({
            queue: [
                {
                    url,
                    depth: 1,
                    state: 'queued',
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [],
                    alternates: null,
                },
            ],
            linkedHosts: { 'old.com': 'https://old.com/' },
        });

        answering(async () =>
            answered(
                [{ url, status: 200 }],
                '<a href="https://staging.acme.com/pricing">a</a><a href="https://staging.acme.com/other">b</a><a href="/team">c</a><a href="https://www.acme.com/x">d</a>',
            ),
        );

        await readPages('project', 'run', 'audit', firstPace);

        expect(call(fake, 'audits', 'select')[0].calls[0][1]).toContain(
            'linked_hosts',
        );

        expect(call(fake, 'audits', 'update')[0].calls[0][1]).toMatchObject({
            linked_hosts: {
                'old.com': 'https://old.com/',
                'staging.acme.com': 'https://staging.acme.com/pricing',
            },
        });
    });
});

describe('probeSite', () => {
    const token = /^[a-z0-9]{24}$/;
    const home = 'https://acme.com/';
    const pricing = 'https://acme.com/pricing';
    const staging = 'https://staging.acme.com/pricing';

    function probedSite() {
        return database({
            sitePages: [
                { id: 'id of home', url: home },
                { id: 'id of pricing', url: pricing },
            ],
            linkedHosts: {
                'staging.acme.com': staging,
                'cdn.other.com': 'https://cdn.other.com/a.js',
            },
            robotsRules: [
                robotsFile('https://acme.com/robots.txt', {
                    ok: true,
                    status: 200,
                    hops: [],
                    body: 'User-agent: *\nDisallow: /shop/',
                    bytes: 0,
                }),
            ],
            queue: [
                {
                    url: home,
                    depth: 0,
                    state: 'read',
                    in_sitemap: false,
                    inbound_links: 0,
                    linked_from: [],
                    alternates: null,
                },
                {
                    url: 'https://acme.com/shop/1',
                    depth: 1,
                    state: 'blocked',
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [],
                    alternates: null,
                },
            ],
        });
    }

    function answerProbes() {
        return answering(async (url) => {
            const { hostname, pathname } = new URL(url);
            const isRandom = token.test(pathname.split('/').at(-1)!);

            if (isRandom && hostname === 'acme.com') {
                return answered([{ url, status: 200 }]);
            }

            if (isRandom && hostname === 'www.acme.com') {
                return answered([
                    { url, status: 301 },
                    { url: home, status: 200 },
                ]);
            }

            if (url === 'https://www.acme.com/pricing' || url === staging) {
                return answered([{ url, status: 200 }], '<h1>Pricing</h1>');
            }

            return notFound(url);
        });
    }

    it('deletes its own findings first, then writes what the probes and the queue show', async () => {
        const fake = probedSite();

        answerProbes();

        await probeSite('project', 'run', 'audit', firstPace);

        expect(
            call(fake, 'audit_findings', 'delete').map(({ calls }) => calls),
        ).toEqual([
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                [
                    'in',
                    'check',
                    [
                        'soft-404',
                        'redirect-to-home',
                        'staging-indexable',
                        'ai-cdn-blocked',
                        'pay-per-crawl',
                        'markdown-alternate',
                    ],
                ],
                ['is', 'site_page_id', null],
            ],
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['in', 'check', ['host-variants', 'mobile-content-differs']],
            ],
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['eq', 'check', 'https-missing'],
                ['contains', 'detail', { reason: 'no-redirect' }],
            ],
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['eq', 'check', 'robots-googlebot-blocked'],
                ['contains', 'detail', { reason: 'content-paths' }],
            ],
        ]);

        expect(call(fake, 'site_pages', 'select')[0].calls).toEqual([
            ['select', 'id, url'],
            ['eq', 'last_audit_id', 'audit'],
            ['eq', 'is_indexable', true],
            ['eq', 'status_code', 200],
            ['is', 'redirect_to', null],
            ['order', 'url'],
            ['range', 0, 999],
        ]);

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.site_page_id,
                row.subject,
            ]),
        ).toEqual([
            ['robots-googlebot-blocked', null, 'content-paths'],
            ['soft-404', null, 'https://acme.com'],
            ['redirect-to-home', null, 'https://www.acme.com'],
            ['host-variants', 'id of pricing', 'https://www.acme.com/pricing'],
            ['staging-indexable', null, 'staging.acme.com'],
        ]);

        expect(markProgress).toHaveBeenCalledWith('run');
    });

    it('asks for markdown, then sends GET to the missing paths, the host variants with the http twin, the desktop and phone fetch of the sample and the staging host, and adds its requests to the counts', async () => {
        const fake = probedSite();
        const client = answerProbes();

        client.counts.requests = 10;
        client.counts.tooMany = 1;
        client.counts.serverErrors = 2;

        await probeSite('project', 'run', 'audit', firstPace);

        const methods = client.read.mock.calls.map(([url, options]) => [
            url.replace(/[a-z0-9]{24}$/, '<random>'),
            options?.method,
            options?.headers === phoneHeaders ? 'phone' : options?.headers,
        ]);

        expect(methods).toEqual([
            [home, undefined, { accept: markdownAccept }],
            ['https://acme.com/<random>', 'GET', undefined],
            ['https://www.acme.com/<random>', 'GET', undefined],
            ['https://acme.de/<random>', 'GET', undefined],
            ['https://www.acme.de/<random>', 'GET', undefined],
            ['https://www.acme.com/', 'GET', undefined],
            ['http://acme.com/', 'GET', undefined],
            ['https://www.acme.com/pricing', 'GET', undefined],
            ['https://acme.com/pricing/', 'GET', undefined],
            ['https://acme.com/Pricing', 'GET', undefined],
            ['http://acme.com/pricing', 'GET', undefined],
            [home, 'GET', undefined],
            [home, 'GET', 'phone'],
            [pricing, 'GET', undefined],
            [pricing, 'GET', 'phone'],
            [staging, 'GET', undefined],
        ]);

        expect(call(fake, 'audits', 'update')[0].calls[0][1]).toEqual({
            request_count: 13,
            host_429_count: 2,
            host_5xx_count: 4,
            cdn_test: 'browser-refused',
        });
    });

    it('reports an http twin served over http and a phone page that differs, and judges no phone fetch whose desktop fetch failed', async () => {
        const fake = probedSite();

        const page = (title: string) =>
            `<html><head><title>${title}</title></head><body><h1>${title}</h1></body></html>`;

        answering(async (url, options) => {
            if (url === 'http://acme.com/pricing') {
                return answered([{ url, status: 200 }], page('Pricing'));
            }

            if (url === home) {
                return options?.headers
                    ? answered([{ url, status: 200 }], page('Phone'))
                    : new Error('reset');
            }

            if (url === pricing) {
                return answered(
                    [{ url, status: 200 }],
                    page(options?.headers ? 'Phone' : 'Pricing'),
                );
            }

            return notFound(url);
        });

        await probeSite('project', 'run', 'audit', firstPace);

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.site_page_id,
                row.subject,
            ]),
        ).toEqual([
            ['robots-googlebot-blocked', null, 'content-paths'],
            ['markdown-alternate', null, home],
            ['https-missing', 'id of pricing', 'http://acme.com/pricing'],
            ['mobile-content-differs', 'id of pricing', pricing],
        ]);
    });

    it('stops the CDN test, the markdown asks and the probes when the step budget runs out, and keeps what it found', async () => {
        const fake = probedSite();
        const client = answering(async () => null);

        await probeSite('project', 'run', 'audit', firstPace);

        expect(client.readWithoutSecret).toHaveBeenCalledTimes(1);
        expect(client.read).toHaveBeenCalledTimes(2);

        expect(
            inserted(fake, 'audit_findings').map((row) => row.check),
        ).toEqual(['robots-googlebot-blocked']);
    });

    it('fails the audit after its writes when the site stopped answering', async () => {
        const fake = probedSite();

        answering(async (url) => notFound(url), { ...firstPace, streak: 20 });

        await expect(
            probeSite('project', 'run', 'audit', firstPace),
        ).rejects.toThrow(stoppedAnswering);

        expect(fake.writes()).toContain('update audits');
        expect(markProgress).toHaveBeenCalledWith('run');
    });

    it('leaves an audit whose run has ended as it is, so a stopped audit sends no probe', async () => {
        const fake = database({ runStatus: 'failed' });

        await probeSite('project', 'run', 'audit', firstPace);

        expect(fake.writes()).toEqual([]);
        expect(siteClient).not.toHaveBeenCalled();
    });
});

describe('probeSite, for the CDN test and markdown', () => {
    const home = 'https://acme.com/';
    const agents = cdnTestAgents.map(({ userAgent: sent }) => sent);

    const controls = [
        desktopUserAgent,
        userAgent,
        googlebotUserAgent,
        bingbotUserAgent,
    ];

    interface Sent {
        url: string;
        userAgent: string | null;
        accept: string | null;
        secret: string | null;
    }

    async function siteAnswering(
        answer: (url: string, sent: Sent) => Response,
    ) {
        const actual = await vi.importActual<{
            siteClient: typeof siteClient;
        }>('@/features/audit/client');

        const sent: Sent[] = [];
        const pacesAfterCdnTest: Pace[] = [];

        vi.mocked(siteClient).mockImplementation((options) => {
            const client = actual.siteClient({
                ...options,
                interval: 1,
                deadline: Date.now() + 5_000,
                deps: {
                    fetch: async (input, init) => {
                        const headers = new Headers(init?.headers);

                        const request = {
                            url: String(input),
                            userAgent: headers.get('user-agent'),
                            accept: headers.get('accept'),
                            secret: headers.get(botSecretHeader),
                        };

                        sent.push(request);

                        return answer(request.url, request);
                    },
                    lookup: async () => ['93.184.216.34'],
                },
            });

            return {
                ...client,
                read: async (url, readOptions) => {
                    pacesAfterCdnTest.push(client.pace());

                    return client.read(url, readOptions);
                },
            };
        });

        return { sent, pacesAfterCdnTest };
    }

    const cdnRequests = (sent: Sent[]) =>
        sent.filter(({ url, secret }) => url === home && secret === null);

    const notFound = () => new Response('', { status: 404 });

    function cdnSite(
        cdnAnswer: (userAgent: string | null) => Response | 'throw',
    ) {
        return (url: string, request: Sent) => {
            if (url !== home) {
                return notFound();
            }

            if (request.secret !== null) {
                return ok();
            }

            const answer = cdnAnswer(request.userAgent);

            if (answer === 'throw') {
                throw new Error('connect ETIMEDOUT');
            }

            return answer;
        };
    }

    const ok = () => new Response('<h1>Acme</h1>', { status: 200 });

    function updated(fake: ReturnType<typeof database>) {
        return call(fake, 'audits', 'update').at(-1)!.calls[0][1] as Record<
            string,
            unknown
        >;
    }

    it('writes each outcome of the CDN test on the audit, and none when a control gets no answer', async () => {
        const cases: [
            (userAgent: string | null) => Response | 'throw',
            string | null,
        ][] = [
            [() => ok(), 'passed'],
            [() => new Response('', { status: 403 }), 'browser-refused'],
            [
                (agent) =>
                    agent === desktopUserAgent
                        ? ok()
                        : new Response('', { status: 403 }),
                'bot-refused',
            ],
            [
                (agent) =>
                    agent === bingbotUserAgent
                        ? new Response('', {
                              status: 403,
                              headers: { 'cf-mitigated': 'challenge' },
                          })
                        : ok(),
                'spoof-refused',
            ],
            [(agent) => (agent === desktopUserAgent ? 'throw' : ok()), null],
            [(agent) => (agent === userAgent ? 'throw' : ok()), null],
            [(agent) => (agent === googlebotUserAgent ? 'throw' : ok()), null],
        ];

        for (const [cdnAnswer, outcome] of cases) {
            const fake = database();

            await siteAnswering(cdnSite(cdnAnswer));
            await probeSite('project', 'run', 'audit', firstPace);

            expect(updated(fake).cdn_test, String(outcome)).toBe(outcome);
        }
    });

    it('asks no agent after a control that failed, writes spoof-refused when the claimed Googlebot is refused, and asks the four controls before the 8 agents and the browser again after them', async () => {
        const refusedBot = await siteAnswering(
            cdnSite((agent) =>
                agent === desktopUserAgent
                    ? ok()
                    : new Response('', { status: 403 }),
            ),
        );

        database();
        await probeSite('project', 'run', 'audit', firstPace);

        expect(
            cdnRequests(refusedBot.sent).map(({ userAgent: sent }) => sent),
        ).toEqual([desktopUserAgent, userAgent]);

        const refusedSpoof = await siteAnswering(
            cdnSite((agent) =>
                agent === googlebotUserAgent
                    ? new Response('', { status: 403 })
                    : ok(),
            ),
        );

        const fake = database();

        await probeSite('project', 'run', 'audit', firstPace);

        expect(updated(fake).cdn_test).toBe('spoof-refused');

        expect(
            cdnRequests(refusedSpoof.sent).map(({ userAgent: sent }) => sent),
        ).toEqual([desktopUserAgent, userAgent, googlebotUserAgent]);

        expect(
            refusedSpoof.sent.filter(({ userAgent: sent }) =>
                agents.includes(sent!),
            ),
        ).toEqual([]);

        const passed = await siteAnswering(cdnSite(() => ok()));

        database();
        await probeSite('project', 'run', 'audit', firstPace);

        expect(
            cdnRequests(passed.sent).map(({ userAgent: sent }) => sent),
        ).toEqual([...controls, ...agents, desktopUserAgent]);

        expect(
            [...refusedBot.sent, ...passed.sent].filter(
                ({ userAgent: sent, secret }) =>
                    agents.includes(sent!) && secret !== null,
            ),
        ).toEqual([]);
    });

    it('sends the CDN test without the bot secret and the markdown asks and the other probes with it', async () => {
        const { sent } = await siteAnswering(cdnSite(() => ok()));

        database();
        await probeSite('project', 'run', 'audit', firstPace);

        const signed = sent.filter(({ secret }) => secret !== null);

        expect(cdnRequests(sent)).toHaveLength(13);
        expect(signed.every(({ secret }) => secret === 's')).toBe(true);

        expect(
            signed.slice(0, 4).map(({ url, accept }) => [url, accept]),
        ).toEqual([
            [home, markdownAccept],
            ['https://acme.com/index.md', 'text/html,*/*'],
            ['https://acme.com/index.html.md', 'text/html,*/*'],
            ['https://acme.com/llms.txt', 'text/html,*/*'],
        ]);

        expect(signed.some(({ url }) => /\/[a-z0-9]{24}$/.test(url))).toBe(
            true,
        );

        expect(
            sent.filter(
                ({ secret, url }) =>
                    secret === null &&
                    new URL(url).hostname.endsWith('acme.com') &&
                    url !== home,
            ),
        ).toEqual([]);
    });

    it('takes no pause and no streak from the CDN test’s 429 and 503 answers, so the probes after it go at once', async () => {
        const { sent, pacesAfterCdnTest } = await siteAnswering(
            cdnSite((agent) => {
                if (controls.includes(agent!)) {
                    return ok();
                }

                return new Response('', {
                    status: agents.indexOf(agent!) % 2 === 0 ? 429 : 503,
                    headers: { 'retry-after': '60' },
                });
            }),
        );

        const fake = database();

        await probeSite('project', 'run', 'audit', {
            ...firstPace,
            streak: 19,
        });

        expect(pacesAfterCdnTest[0]).toMatchObject({ pauseMs: 0, streak: 19 });
        expect(pacesAfterCdnTest[0].nextAt).toBeLessThan(Date.now() + 1_000);
        expect(cdnRequests(sent)).toHaveLength(13);

        expect(sent.some(({ url }) => /\/[a-z0-9]{24}$/.test(url))).toBe(true);

        expect(updated(fake)).toMatchObject({
            cdn_test: 'passed',
            host_429_count: 1,
            host_5xx_count: 2,
        });
    });

    it('writes its own outcome and findings over those of an earlier try of the step', async () => {
        const first = database();

        await siteAnswering(
            cdnSite((agent) =>
                agent === agents[2]
                    ? new Response('', {
                          status: 403,
                          headers: { 'cf-ray': '1' },
                      })
                    : ok(),
            ),
        );

        await probeSite('project', 'run', 'audit', firstPace);

        expect(updated(first).cdn_test).toBe('passed');

        expect(
            inserted(first, 'audit_findings').find(
                ({ check }) => check === 'ai-cdn-blocked',
            ),
        ).toMatchObject({ site_page_id: null, subject: home });

        const retried = database();

        await siteAnswering(cdnSite(() => new Response('', { status: 403 })));

        await probeSite('project', 'run', 'audit', firstPace);

        expect(updated(retried).cdn_test).toBe('browser-refused');

        expect(
            inserted(retried, 'audit_findings').map(({ check }) => check),
        ).not.toContain('ai-cdn-blocked');

        expect(
            call(retried, 'audit_findings', 'delete')[0].calls,
        ).toContainEqual([
            'in',
            'check',
            expect.arrayContaining(['ai-cdn-blocked', 'pay-per-crawl']),
        ]);
    });

    it('leaves the agents robots.txt disallows on the home page out of ai-cdn-blocked, by the Googlebot fallback too, when the audit ignores robots.txt', async () => {
        const fake = database({
            obeyRobots: false,
            robotsRules: [
                robotsFile('https://acme.com/robots.txt', {
                    ok: true,
                    status: 200,
                    hops: [],
                    body: 'User-agent: Googlebot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /',
                    bytes: 0,
                }),
            ],
        });

        const refused = ['OAI-SearchBot', 'PerplexityBot', 'Applebot'].map(
            (name) => cdnTestAgents.find(({ agent }) => agent === name)!,
        );

        await siteAnswering(
            cdnSite((sent) =>
                refused.some(({ userAgent: value }) => value === sent)
                    ? new Response('', { status: 403 })
                    : ok(),
            ),
        );

        await probeSite('project', 'run', 'audit', firstPace);

        expect(updated(fake).cdn_test).toBe('passed');

        expect(
            inserted(fake, 'audit_findings').find(
                ({ check }) => check === 'ai-cdn-blocked',
            ),
        ).toMatchObject({
            detail: {
                agents: ['OAI-SearchBot'],
                answers: {
                    'OAI-SearchBot': '403',
                    PerplexityBot: '403',
                    Applebot: '403',
                },
            },
        });
    });

    it('sends no probe at all when a CitequillBot group disallows everything, and leaves the CDN test without an outcome', async () => {
        const fake = database({
            robotsRules: [
                'https://acme.com',
                'https://www.acme.com',
                'http://acme.com',
                'http://www.acme.com',
                'https://acme.de',
                'https://www.acme.de',
                'http://acme.de',
                'http://www.acme.de',
            ].map((origin) =>
                robotsFile(`${origin}/robots.txt`, {
                    ok: true,
                    status: 200,
                    hops: [],
                    body: 'User-agent: CitequillBot\nDisallow: /',
                    bytes: 0,
                }),
            ),
            sitePages: [{ id: 'id of home', url: home }],
        });

        const { sent } = await siteAnswering(cdnSite(() => ok()));

        await probeSite('project', 'run', 'audit', firstPace);

        expect(sent).toEqual([]);
        expect(updated(fake).cdn_test).toBeNull();
        expect(inserted(fake, 'audit_findings')).toEqual([]);
    });

    it('sends neither the CDN test nor the markdown asks when robots.txt blocks the home page for the audit', async () => {
        const fake = database({
            robotsRules: [
                robotsFile('https://acme.com/robots.txt', {
                    ok: true,
                    status: 200,
                    hops: [],
                    body: 'User-agent: Googlebot\nDisallow: /$',
                    bytes: 0,
                }),
            ],
        });

        const { sent } = await siteAnswering(cdnSite(() => ok()));

        await probeSite('project', 'run', 'audit', firstPace);

        expect(sent.filter(({ url }) => url === home)).toEqual([]);

        expect(
            sent.filter(({ url }) =>
                ['index.md', 'index.html.md', 'llms.txt'].some((name) =>
                    url.endsWith(name),
                ),
            ),
        ).toEqual([]);

        expect(sent.length).toBeGreaterThan(0);
        expect(updated(fake).cdn_test).toBeNull();

        expect(
            inserted(fake, 'audit_findings').map(({ check }) => check),
        ).not.toContain('markdown-alternate');
    });
});

describe('readPages, before it writes the batch', () => {
    it('reads the redirect each URL of the batch held, so redirect-temporary compares with the audit before', async () => {
        const url = 'https://acme.com/moved';
        const target = 'https://acme.com/new';

        const fake = database({
            queue: [
                {
                    url,
                    depth: 1,
                    state: 'queued',
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [],
                    alternates: null,
                },
            ],
            sitePages: [{ url, redirect_to: target }],
        });

        answering(async () => ({
            ...notFound(url),
            ok: true,
            status: 200,
            hops: [
                { url, status: 302 },
                { url: target, status: 200 },
            ],
        }));

        await readPages('project', 'run', 'audit', firstPace);

        const [select] = call(fake, 'site_pages', 'select');

        expect(select.calls).toEqual([
            ['select', 'url, redirect_to'],
            ['eq', 'project_id', 'project'],
            ['in', 'url', [url]],
        ]);

        expect(
            fake.queries.findIndex((query) => query === select),
        ).toBeLessThan(
            fake.queries.findIndex(
                (query) =>
                    query.name === 'site_pages' &&
                    query.calls[0][0] === 'upsert',
            ),
        );

        expect(
            inserted(fake, 'audit_findings').map((row) => row.check),
        ).toContain('redirect-temporary');
    });
});

describe('checkSite', () => {
    it('leaves an audit whose run has ended as it is, so a stopped audit has no checks that compare pages', async () => {
        const fake = database({ runStatus: 'failed' });

        await checkSite('project', 'run', 'audit');

        expect(fake.writes()).toEqual([]);
        expect(markProgress).not.toHaveBeenCalled();
    });

    it("replaces the audit's cross-page findings with what its pages show together", async () => {
        const page = (path: string) => ({
            id: `id of ${path}`,
            url: `https://acme.com${path}`,
            status_code: 200,
            redirect_to: null,
            is_indexable: true,
            is_blocked: false,
            canonical_url: null,
            in_sitemap: true,
            body_hash: 'same',
        });

        const fake = database({ sitePages: [page('/a'), page('/b')] });

        await checkSite('project', 'run', 'audit');

        expect(call(fake, 'site_pages', 'select')[0].calls).toContainEqual([
            'eq',
            'last_audit_id',
            'audit',
        ]);

        expect(call(fake, 'audit_findings', 'delete')[0].calls).toContainEqual([
            'in',
            'check',
            expect.arrayContaining(['duplicate-body']),
        ]);

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.site_page_id,
            ]),
        ).toEqual([
            ['duplicate-body', 'id of /a'],
            ['duplicate-body', 'id of /b'],
        ]);

        expect(markProgress).toHaveBeenCalledWith('run');
    });

    it('deletes only its own halves of the checks with a page half, told apart by their reason', async () => {
        const fake = database();

        await checkSite('project', 'run', 'audit');

        expect(
            call(fake, 'audit_findings', 'delete')
                .slice(1)
                .map(({ calls }) => calls),
        ).toEqual([
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['eq', 'check', 'param-duplicates'],
                ['contains', 'detail', { reason: 'variants' }],
            ],
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['eq', 'check', 'facets-indexable'],
                ['contains', 'detail', { reason: 'volume' }],
            ],
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['eq', 'check', 'assets-heavy'],
                ['contains', 'detail', { reason: 'bytes' }],
            ],
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['eq', 'check', 'structured-data-format'],
                ['contains', 'detail', { reason: 'none' }],
            ],
        ]);
    });

    it('weighs the scripts and stylesheets of each home page that answered 200, by the Content-Length the resource step read', async () => {
        const home = 'https://acme.com/';

        const asset = (
            url: string,
            contentLength: number | null,
            overrides: Record<string, unknown> = {},
        ) => ({
            url,
            kind: 'asset',
            linked_from: [home],
            link_count: 1,
            state: 'checked',
            status_code: 200,
            content_length: contentLength,
            error: null,
            ...overrides,
        });

        const fake = database({
            sitePages: [
                {
                    id: 'id of home',
                    url: home,
                    status_code: 200,
                    redirect_to: null,
                    is_indexable: true,
                    is_blocked: false,
                    canonical_url: null,
                    in_sitemap: true,
                },
            ],
            resources: [
                asset('https://acme.com/app.js', 1_500_000),
                asset('https://acme.com/app.css', 600_000),
                asset('https://acme.com/lazy.js', null),
                asset('https://acme.com/gone.js', 900_000, {
                    status_code: 404,
                }),
                asset('https://acme.com/hero.png', 900_000, { kind: 'image' }),
            ],
        });

        await checkSite('project', 'run', 'audit');

        expect(call(fake, 'audit_resources', 'select')[0].calls).toContainEqual(
            ['select', 'linked_from, content_length'],
        );

        expect(
            inserted(fake, 'audit_findings').filter(
                (row) => row.check === 'assets-heavy',
            ),
        ).toMatchObject([
            {
                site_page_id: 'id of home',
                detail: { reason: 'bytes', bytes: 2_100_000, files: 3 },
            },
        ]);
    });
});

describe('checkSite, for hreflang', () => {
    it("reads each page's hreflang column and the sitemap sets the queue keeps, and rewrites the hreflang findings that compare pages", async () => {
        const page = (path: string) => ({
            id: `id of ${path}`,
            url: `https://acme.com${path}`,
            status_code: 200,
            redirect_to: null,
            is_indexable: true,
            is_blocked: false,
            canonical_url: null,
            in_sitemap: true,
            image_count: 0,
            external_link_count: 0,
            hreflang_count: 2,
            hreflang: [],
        });

        const listed = (path: string, alternates: string[]) => ({
            url: `https://acme.com${path}`,
            depth: null,
            state: 'read' as const,
            in_sitemap: true,
            inbound_links: 0,
            linked_from: [],
            alternates: alternates.map((href, i) => ({
                lang: ['en', 'de'][i],
                href: `https://acme.com${href}`,
            })),
        });

        const fake = database({
            queue: [listed('/en', ['/en', '/de']), listed('/de', ['/de'])],
            sitePages: [page('/en'), page('/de')],
        });

        await checkSite('project', 'run', 'audit');

        expect(call(fake, 'site_pages', 'select')[0].calls[0][1]).toContain(
            'hreflang_count',
        );

        expect(call(fake, 'site_pages', 'select')[0].calls[0][1]).toContain(
            ', hreflang',
        );

        expect(call(fake, 'site_pages', 'select')[0].calls[0][1]).toContain(
            'jsonld_count',
        );

        expect(call(fake, 'site_pages', 'select')[0].calls[0][1]).toContain(
            'has_microdata',
        );

        expect(call(fake, 'audit_findings', 'delete')[0].calls).toContainEqual([
            'in',
            'check',
            expect.arrayContaining(['sitemap-hreflang', 'hreflang-return']),
        ]);

        expect(
            inserted(fake, 'audit_findings')
                .filter((row) => row.check === 'sitemap-hreflang')
                .map((row) => [row.site_page_id, row.subject]),
        ).toEqual([['id of /en', 'https://acme.com/de']]);
    });
});

describe('checkSite, for the links', () => {
    it("writes the queue's inbound counts into the pages before it reads them, and puts a broken link on the pages linking to it", async () => {
        const gone = 'https://acme.com/gone';
        const linking = 'https://acme.com/a';

        const fake = database({
            queue: [
                {
                    url: gone,
                    depth: 2,
                    state: 'read',
                    in_sitemap: false,
                    inbound_links: 3,
                    linked_from: [linking],
                    alternates: null,
                },
                {
                    url: 'https://acme.com/later',
                    depth: 3,
                    state: 'queued',
                    in_sitemap: false,
                    inbound_links: 1,
                    linked_from: [gone],
                    alternates: null,
                },
            ],
            sitePages: [
                {
                    id: 'id of gone',
                    url: gone,
                    status_code: 404,
                    redirect_to: null,
                    is_indexable: false,
                    is_blocked: false,
                    canonical_url: null,
                    in_sitemap: false,
                    image_count: 0,
                    external_link_count: 0,
                    click_depth: 2,
                    inbound_links: 3,
                },
                {
                    id: 'id of a',
                    url: linking,
                    status_code: 200,
                    redirect_to: null,
                    is_indexable: true,
                    is_blocked: false,
                    canonical_url: null,
                    in_sitemap: false,
                    image_count: 0,
                    external_link_count: 0,
                    click_depth: 1,
                    inbound_links: 2,
                },
            ],
        });

        await checkSite('project', 'run', 'audit');

        const upsert = fake.queries.find(
            ({ name, calls }) =>
                name === 'site_pages' && calls[0][0] === 'upsert',
        )!;

        expect(upsert.calls[0][1]).toMatchObject([
            { project_id: 'project', url: gone, inbound_links: 3 },
        ]);

        expect(fake.queries.indexOf(upsert)).toBeLessThan(
            fake.queries.indexOf(call(fake, 'site_pages', 'select')[0]),
        );

        expect(call(fake, 'site_pages', 'select')[0].calls[0][1]).toContain(
            'click_depth, inbound_links',
        );

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.site_page_id,
                row.subject,
            ]),
        ).toEqual([['link-broken-internal', 'id of a', gone]]);
    });
});

describe('checkResources', () => {
    const linking = 'https://acme.com/a';

    function resource(
        url: string,
        kind: string,
        linkedFrom = [linking],
        answer: { state?: string; status_code?: number } = {},
    ) {
        return {
            url,
            kind,
            linked_from: linkedFrom,
            link_count: linkedFrom.length,
            state: 'queued',
            status_code: null,
            content_length: null,
            error: null,
            ...answer,
        };
    }

    const urls = (rows: { url: string }[]) =>
        new Set(rows.map(({ url }) => url));

    const sitePages = [
        {
            id: 'id of home',
            url: 'https://acme.com/',
            is_indexable: true,
            status_code: 200,
            redirect_to: null,
        },
        {
            id: 'id of a',
            url: linking,
            is_indexable: true,
            status_code: 200,
            redirect_to: null,
        },
    ];

    it('leaves an audit whose run has ended as it is, so a stopped audit checks no resource', async () => {
        const fake = database({ runStatus: 'failed' });

        expect(
            await checkResources('project', 'run', 'audit', firstPace),
        ).toEqual({ hasWork: false, pace: firstPace });

        expect(fake.writes()).toEqual([]);
        expect(siteClient).not.toHaveBeenCalled();
    });

    it('takes the first 50 queued rows by kind, images before external links, then by URL, and says when none is left', async () => {
        const externals = Array.from({ length: 45 }, (_, i) =>
            resource(
                `https://other.com/${String(i).padStart(2, '0')}`,
                'external',
            ),
        );

        const images = Array.from({ length: 10 }, (_, i) =>
            resource(`https://www.acme.com/${i}.png`, 'image'),
        );

        const fake = database({
            sitePages,
            resources: [
                ...externals,
                ...images,
                resource('https://acme.com/done.png', 'image', [linking], {
                    state: 'checked',
                    status_code: 200,
                }),
            ],
        });

        answering(async (url) => answered([{ url, status: 200 }]));
        abroad(async (url) => answered([{ url, status: 200 }]));

        const reading = await checkResources(
            'project',
            'run',
            'audit',
            firstPace,
        );

        const [upsert] = call(fake, 'audit_resources', 'upsert');
        const written = upsert.calls[0][1] as { url: string; state: string }[];

        expect(urls(written)).toEqual(
            urls([...images, ...externals.slice(0, 40)]),
        );

        expect(written.every(({ state }) => state === 'checked')).toBe(true);
        expect(reading.hasWork).toBe(true);

        const empty = database();

        expect(
            (await checkResources('project', 'run', 'audit', firstPace))
                .hasWork,
        ).toBe(false);

        expect(empty.writes()).toEqual([]);
    });

    it('sends HEAD, then GET when HEAD is refused with 405, an image under the domain at the site pace and every external link, one under the domain included, abroad', async () => {
        database({
            sitePages,
            resources: [
                resource('https://cdn.acme.com/a.png', 'image'),
                resource('https://other.com/x', 'external'),
                resource('https://blog.acme.com/y', 'external'),
            ],
        });

        const site = answering(async (url, options) =>
            answered([{ url, status: options?.method === 'HEAD' ? 405 : 200 }]),
        );

        const foreign = abroad(async (url) => answered([{ url, status: 200 }]));

        await checkResources('project', 'run', 'audit', firstPace);

        expect(site.read.mock.calls).toEqual([
            ['https://cdn.acme.com/a.png', { method: 'HEAD' }],
            ['https://cdn.acme.com/a.png', { method: 'GET' }],
        ]);

        expect(foreign.read.mock.calls).toEqual([
            ['https://blog.acme.com/y', { method: 'HEAD' }],
            ['https://other.com/x', { method: 'HEAD' }],
        ]);
    });

    it('keeps one request in flight per foreign host, and none between two hosts', async () => {
        database({
            sitePages,
            resources: [
                resource('https://other.com/a', 'external'),
                resource('https://other.com/b', 'external'),
                resource('https://else.net/c', 'external'),
            ],
        });

        answering(async () => null);

        const events: string[] = [];

        abroad(async (url) => {
            events.push(`start ${url}`);
            await new Promise((resolve) => setTimeout(resolve, 5));
            events.push(`end ${url}`);

            return answered([{ url, status: 200 }]);
        });

        await checkResources('project', 'run', 'audit', firstPace);

        expect(events.filter((event) => event.includes('other.com'))).toEqual([
            'start https://other.com/a',
            'end https://other.com/a',
            'start https://other.com/b',
            'end https://other.com/b',
        ]);

        expect(events.indexOf('start https://other.com/a')).toBeLessThan(
            events.indexOf('end https://else.net/c'),
        );
    });

    it('puts a finding on each page linking to a broken resource, deleting the batch’s own findings first, then marks the rows checked', async () => {
        const fake = database({
            sitePages,
            resources: [
                resource('https://acme.com/gone.png', 'image', [
                    linking,
                    'https://acme.com/',
                ]),
                resource('https://acme.com/og.png', 'og_image'),
            ],
        });

        answering(async (url) => notFound(url));
        abroad(async () => null);

        await checkResources('project', 'run', 'audit', firstPace);

        const deletes = call(fake, 'audit_findings', 'delete');
        const batch = ['https://acme.com/gone.png', 'https://acme.com/og.png'];

        expect(deletes.map(filters)).toEqual([
            {
                'eq audit_id': 'audit',
                'in check': resourceChecks,
                'in subject': batch,
            },
            {
                'eq audit_id': 'audit',
                'eq check': 'og-image-bad',
                'contains detail': { reason: 'image' },
                'in subject': batch,
            },
        ]);

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.site_page_id,
                row.subject,
            ]),
        ).toEqual([
            ['resource-broken', 'id of a', 'https://acme.com/gone.png'],
            ['resource-broken', 'id of home', 'https://acme.com/gone.png'],
            ['og-image-bad', 'id of a', 'https://acme.com/og.png'],
        ]);

        const insert = fake.queries.find(
            ({ name, calls }) =>
                name === 'audit_findings' && calls[0][0] === 'insert',
        )!;

        const upsert = call(fake, 'audit_resources', 'upsert')[0];

        for (const query of deletes) {
            expect(fake.queries.indexOf(query)).toBeLessThan(
                fake.queries.indexOf(insert),
            );
        }

        expect(fake.queries.indexOf(insert)).toBeLessThan(
            fake.queries.indexOf(upsert),
        );

        expect(upsert.calls[0][1]).toContainEqual(
            expect.objectContaining({
                url: 'https://acme.com/gone.png',
                state: 'checked',
                status_code: 404,
            }),
        );
    });

    it('refuses the rest of a host after a 403, in the step and from the rows an earlier step checked, without a request', async () => {
        const fake = database({
            sitePages,
            resources: [
                resource('https://other.com/a', 'external'),
                resource('https://other.com/b', 'external'),
                resource('https://shy.net/c', 'external'),
                resource('https://shy.net/old', 'external', [linking], {
                    state: 'checked',
                    status_code: 429,
                }),
            ],
        });

        answering(async () => null);

        const foreign = abroad(async (url) => answered([{ url, status: 403 }]));

        await checkResources('project', 'run', 'audit', firstPace);

        expect(foreign.read.mock.calls.map(([url]) => url)).toHaveLength(1);

        expect(
            inserted(fake, 'audit_findings').map((row) => [
                row.check,
                row.subject,
                (row.detail as { status: number }).status,
            ]),
        ).toEqual(
            expect.arrayContaining([
                ['link-external-refused', 'https://shy.net/c', 429],
                ['link-external-refused', 'https://other.com/b', 403],
            ]),
        );
    });

    it('marks an asset off the sample checked without a request, and leaves a row it had no time for queued', async () => {
        const fake = database({
            sitePages,
            resources: [
                resource('https://acme.com/a.js', 'asset', [
                    'https://acme.com/x/y',
                ]),
                resource('https://acme.com/b.png', 'image'),
            ],
        });

        const site = answering(async () => null);

        abroad(async () => null);

        const reading = await checkResources(
            'project',
            'run',
            'audit',
            firstPace,
        );

        expect(site.read.mock.calls.map(([url]) => url)).toEqual([
            'https://acme.com/b.png',
        ]);

        expect(call(fake, 'audit_resources', 'upsert')[0].calls[0][1]).toEqual([
            expect.objectContaining({
                url: 'https://acme.com/a.js',
                state: 'checked',
                status_code: null,
            }),
        ]);

        expect(inserted(fake, 'audit_findings')).toEqual([]);
        expect(reading.hasWork).toBe(true);
    });

    it('adds the requests of both clients to the audit, and the 429 and 5xx answers of the site alone', async () => {
        const fake = database({
            sitePages,
            resources: [resource('https://acme.com/b.png', 'image')],
        });

        const site = answering(async (url) => answered([{ url, status: 200 }]));
        const foreign = abroad(async () => null);

        site.counts.requests = 4;
        site.counts.tooMany = 1;
        foreign.counts.requests = 6;

        await checkResources('project', 'run', 'audit', firstPace);

        expect(call(fake, 'audits', 'update')[0].calls[0][1]).toEqual({
            request_count: 13,
            host_429_count: 2,
            host_5xx_count: 2,
        });

        expect(markProgress).toHaveBeenCalledWith('run');
    });
});

describe('closeAudit', () => {
    it('leaves an audit whose run has ended as it is, its queue to the retention sweep', async () => {
        const fake = database({ runStatus: 'failed' });

        await closeAudit('project', 'run', 'audit');

        expect(fake.writes()).toEqual([]);
        expect(markProgress).not.toHaveBeenCalled();
        expect(finishRun).not.toHaveBeenCalled();
    });

    it('scores a complete audit, marks the pages it did not meet as gone, sweeps older audits and finishes the run', async () => {
        const fake = database();

        await closeAudit('project', 'run', 'audit');

        expect(fake.writes()).toEqual([
            'rpc score_audit',
            'update audits',
            'update site_pages',
            'delete audit_queue',
            'delete audit_resources',
            'delete audit_check_results',
            'delete audit_findings',
            'delete audit_renders',
        ]);

        expect(call(fake, 'site_pages', 'update')[0].calls).toEqual([
            ['update', { is_gone: true }],
            ['eq', 'project_id', 'project'],
            ['or', 'last_audit_id.is.null,last_audit_id.neq.audit'],
        ]);

        for (const frontier of ['audit_queue', 'audit_resources']) {
            expect(call(fake, frontier, 'delete')[0].calls).toContainEqual([
                'in',
                'audit_id',
                ['audit', 'stopped', 'older'],
            ]);
        }

        for (const table of [
            'audit_check_results',
            'audit_findings',
            'audit_renders',
        ]) {
            expect(call(fake, table, 'delete')[0].calls).toContainEqual([
                'in',
                'audit_id',
                ['stopped'],
            ]);
        }

        expect(finishRun).toHaveBeenCalledWith('run');
    });

    it('keeps the rows of the last finished audit beside the one that ends, and deletes those of a stopped audit between them', async () => {
        const fake = database({
            audits: [
                { id: 'audit', runs: { status: 'running' } },
                { id: 'stopped', runs: { status: 'failed' } },
                { id: 'first', runs: { status: 'finished' } },
                { id: 'oldest', runs: { status: 'finished' } },
            ],
        });

        await closeAudit('project', 'run', 'audit');

        for (const table of [
            'audit_check_results',
            'audit_findings',
            'audit_renders',
        ]) {
            expect(call(fake, table, 'delete')[0].calls).toContainEqual([
                'in',
                'audit_id',
                ['stopped', 'oldest'],
            ]);
        }

        expect(
            call(fake, 'audits', 'select').find(
                ({ calls }) => calls[0][1] === 'id, runs(status)',
            )!.calls,
        ).toEqual([
            ['select', 'id, runs(status)'],
            ['eq', 'project_id', 'project'],
            ['order', 'created_at', { ascending: false }],
        ]);
    });

    it("stores whether the site is a shell from the pages this audit read and the site's home pages", async () => {
        const shellOf = async (isHomeShell: boolean) => {
            const fake = database({
                sitePages: [
                    'https://acme.com/',
                    'https://acme.de/',
                    'https://acme.com/a',
                ].map((url) => ({
                    url,
                    status_code: 200,
                    redirect_to: null,
                    is_shell: url !== 'https://acme.de/' || isHomeShell,
                })),
            });

            await closeAudit('project', 'run', 'audit');

            const read = call(fake, 'site_pages', 'select').find(
                ({ calls }) =>
                    calls[0][1] === 'url, status_code, redirect_to, is_shell',
            )!;

            expect(read.calls.slice(1)).toEqual([
                ['eq', 'last_audit_id', 'audit'],
                ['order', 'url'],
                ['range', 0, rowsPerRead - 1],
            ]);

            return call(fake, 'audits', 'update')[0].calls[0][1];
        };

        expect(await shellOf(true)).toMatchObject({ is_shell: true });
        expect(await shellOf(false)).toMatchObject({ is_shell: false });
    });

    it("empties only its own frontiers on a project's first audit, with no older audit to delete", async () => {
        const fake = database({
            audits: [{ id: 'audit', runs: { status: 'running' } }],
        });

        await closeAudit('project', 'run', 'audit');

        expect(
            fake.writes().filter((write) => write.startsWith('delete')),
        ).toEqual(['delete audit_queue', 'delete audit_resources']);

        expect(call(fake, 'audit_queue', 'delete')[0].calls).toContainEqual([
            'in',
            'audit_id',
            ['audit'],
        ]);

        expect(finishRun).toHaveBeenCalledWith('run');
    });

    it('leaves the pages it did not meet as they were when the audit is partial or its queue is not read', async () => {
        for (const setup of [
            { isPartial: true },
            {
                queue: [
                    {
                        url: 'https://acme.com/later',
                        depth: 3,
                        state: 'queued' as const,
                        in_sitemap: false,
                        inbound_links: 1,
                        linked_from: [],
                        alternates: null,
                    },
                ],
            },
        ]) {
            const fake = database(setup);

            await closeAudit('project', 'run', 'audit');

            expect(call(fake, 'site_pages', 'update')).toEqual([]);
            expect(fake.writes()).toContain('rpc score_audit');
        }
    });
});

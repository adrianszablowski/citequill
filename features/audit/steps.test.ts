import { beforeEach, describe, expect, it, vi } from 'vitest';

import { siteClient } from '@/features/audit/client';
import { firstPace, stoppedAnswering } from '@/features/audit/pacing';
import type { QueueEntry } from '@/features/audit/queue';
import { type RobotsFile, robotsFile } from '@/features/audit/robots';
import {
    checkSite,
    closeAudit,
    discoverSite,
    probeSite,
    readPages,
} from '@/features/audit/steps';
import type { Fetched } from '@/features/crawl/fetch';
import { finishRun, markProgress } from '@/features/runs/steps';
import { createAdminClient } from '@/lib/supabase/admin';
import { type FakeQuery, fakeSupabase } from '@/lib/supabase/fake';

vi.mock('@/lib/supabase/admin', () => {
    return { createAdminClient: vi.fn() };
});

vi.mock('@/features/runs/steps', () => {
    return { finishRun: vi.fn(async () => {}), markProgress: vi.fn() };
});

vi.mock('@/features/audit/client', () => {
    return { siteClient: vi.fn() };
});

const startedAt = '2026-10-17T10:00:00Z';

interface Setup {
    runStatus?: string;
    queue?: QueueEntry[];
    isPartial?: boolean;
    sitePages?: object[];
    linkedHosts?: object | null;
    robotsRules?: RobotsFile[];
    audits?: object[];
}

function database({
    runStatus = 'running',
    queue = [],
    isPartial = false,
    sitePages = [],
    linkedHosts = null,
    robotsRules = [],
    audits = [
        { id: 'audit', runs: { status: 'running' } },
        { id: 'stopped', runs: { status: 'failed' } },
        { id: 'older', runs: { status: 'finished' } },
    ],
}: Setup = {}) {
    const answers: Record<string, (query: FakeQuery) => object> = {
        runs: () => ({ data: { status: runStatus, started_at: startedAt } }),
        projects: () => ({
            data: { domain: 'acme.com', obey_robots: true, bot_secret: 's' },
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
        pages: () => ({ data: [] }),
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
        options?: { method?: 'GET' | 'HEAD' },
    ) => Promise<Fetched | Error | null>,
    pace = firstPace,
) {
    const client = {
        read: vi.fn(read),
        counts: { requests: 0, tooMany: 0, serverErrors: 0 },
        pace: () => pace,
    };

    vi.mocked(siteClient).mockReturnValue(client);

    return client;
}

function notFound(url: string): Fetched {
    return {
        ok: false,
        status: 404,
        url,
        headers: new Headers(),
        body: '',
        isTruncated: false,
        hops: [{ url, status: 404 }],
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
        isTruncated: false,
        hops,
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

beforeEach(() => {
    vi.clearAllMocks();
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
                }),
            ],
            queue: [
                {
                    url: home,
                    depth: 0,
                    state: 'read',
                    in_sitemap: false,
                    inbound_links: 0,
                },
                {
                    url: 'https://acme.com/shop/1',
                    depth: 1,
                    state: 'blocked',
                    in_sitemap: false,
                    inbound_links: 1,
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
                    ['soft-404', 'redirect-to-home', 'staging-indexable'],
                ],
                ['is', 'site_page_id', null],
            ],
            [
                ['delete'],
                ['eq', 'audit_id', 'audit'],
                ['eq', 'check', 'host-variants'],
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

    it('sends GET to the missing paths, the host variants and the staging host, and adds its requests to the counts', async () => {
        const fake = probedSite();
        const client = answerProbes();

        client.counts.requests = 10;
        client.counts.tooMany = 1;
        client.counts.serverErrors = 2;

        await probeSite('project', 'run', 'audit', firstPace);

        const methods = client.read.mock.calls.map(([url, options]) => [
            url.replace(/[a-z0-9]{24}$/, '<random>'),
            options?.method,
        ]);

        expect(methods).toEqual([
            ['https://acme.com/<random>', 'GET'],
            ['https://www.acme.com/<random>', 'GET'],
            ['https://acme.de/<random>', 'GET'],
            ['https://www.acme.de/<random>', 'GET'],
            ['https://www.acme.com/', 'GET'],
            ['https://www.acme.com/pricing', 'GET'],
            ['https://acme.com/pricing/', 'GET'],
            ['https://acme.com/Pricing', 'GET'],
            [staging, 'GET'],
        ]);

        expect(call(fake, 'audits', 'update')[0].calls[0][1]).toEqual({
            request_count: 13,
            host_429_count: 2,
            host_5xx_count: 4,
        });
    });

    it('stops probing when the step budget runs out and keeps what it found', async () => {
        const fake = probedSite();
        const client = answering(async () => null);

        await probeSite('project', 'run', 'audit', firstPace);

        expect(client.read).toHaveBeenCalledTimes(1);

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

    it('deletes only its own halves of param-duplicates and facets-indexable, told apart by their reason', async () => {
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
        ]);
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
            'delete audit_check_results',
            'delete audit_findings',
            'delete audit_renders',
        ]);

        expect(call(fake, 'site_pages', 'update')[0].calls).toEqual([
            ['update', { is_gone: true }],
            ['eq', 'project_id', 'project'],
            ['or', 'last_audit_id.is.null,last_audit_id.neq.audit'],
        ]);

        expect(call(fake, 'audit_queue', 'delete')[0].calls).toContainEqual([
            'in',
            'audit_id',
            ['audit', 'stopped', 'older'],
        ]);

        for (const table of [
            'audit_check_results',
            'audit_findings',
            'audit_renders',
        ]) {
            expect(call(fake, table, 'delete')[0].calls).toContainEqual([
                'in',
                'audit_id',
                ['older'],
            ]);
        }

        expect(finishRun).toHaveBeenCalledWith('run');
    });

    it("empties only its own queue on a project's first audit, with no older audit to delete", async () => {
        const fake = database({
            audits: [{ id: 'audit', runs: { status: 'running' } }],
        });

        await closeAudit('project', 'run', 'audit');

        expect(
            fake.writes().filter((write) => write.startsWith('delete')),
        ).toEqual(['delete audit_queue']);

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

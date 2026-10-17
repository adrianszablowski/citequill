import { beforeEach, describe, expect, it, vi } from 'vitest';

import { siteClient } from '@/features/audit/client';
import { firstPace } from '@/features/audit/pacing';
import type { QueueEntry } from '@/features/audit/queue';
import {
    checkSite,
    closeAudit,
    discoverSite,
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
    audits?: object[];
}

function database({
    runStatus = 'running',
    queue = [],
    isPartial = false,
    sitePages = [],
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
                          robots_rules: [],
                          request_count: 0,
                          host_429_count: 0,
                          host_5xx_count: 0,
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

function answering(read: (url: string) => Promise<Fetched | Error | null>) {
    const client = {
        read: vi.fn(read),
        counts: { requests: 0, tooMany: 0, serverErrors: 0 },
        pace: () => firstPace,
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

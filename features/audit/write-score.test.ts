import { describe, expect, it } from 'vitest';

import { writeScore } from '@/features/audit/write-score';
import { type FakeQuery, fakeSupabase } from '@/lib/supabase/fake';
import { rowsPerRead } from '@/lib/supabase/result';

function database(overrides: Record<string, object> = {}) {
    const answers: Record<string, object> = {
        projects: { data: { domain: 'acme.com', obey_robots: true } },
        audits: {
            data: { robots_rules: [], created_at: '2026-10-18T10:00:00Z' },
        },
        'older audits': { data: [] },
        project_locales: { data: [{ base_url: 'https://acme.com' }] },
        site_pages: {
            data: ['/', '/a', '/b', '/c'].map((path, index) => ({
                id: `page-${index}`,
                url: `https://acme.com${path}`,
                status_code: 200,
                redirect_to: null,
                is_indexable: true,
                is_blocked: false,
                canonical_url: index === 2 ? 'https://acme.com/gone' : null,
                in_sitemap: true,
            })),
        },
        audit_findings: {
            data: [
                {
                    id: 'finding-1',
                    check: 'page-4xx',
                    severity: '3',
                    site_page_id: 'page-1',
                    subject: null,
                    selector: null,
                    fingerprint: 'kept',
                },
                {
                    id: 'finding-2',
                    check: 'canonical-to-error',
                    severity: '3',
                    site_page_id: 'page-2',
                    subject: 'https://acme.com/gone',
                    selector: null,
                    fingerprint: 'new',
                },
            ],
        },
        audit_marks: {
            data: [{ check: 'canonical-to-error', url: null, selector: null }],
        },
        ...overrides,
    };

    return fakeSupabase((query) => answers[answerOf(query)] ?? {});
}

function answerOf({ name, calls }: FakeQuery) {
    const isOn = (column: string, value: string) =>
        calls.some(
            ([method, ...args]) =>
                method === 'eq' && args[0] === column && args[1] === value,
        );

    if (name === 'audits' && !isOn('id', 'audit')) {
        return 'older audits';
    }

    if (name === 'audit_findings' && isOn('audit_id', 'previous')) {
        return 'previous findings';
    }

    if (name === 'audit_check_results' && isOn('audit_id', 'previous')) {
        return 'previous results';
    }

    return name;
}

function earlierAudits(checksRun: string[] | null, isGated = false) {
    return {
        'older audits': {
            data: [
                {
                    id: 'running',
                    is_gated: false,
                    checks_run: checksRun,
                    runs: { status: 'running' },
                },
                {
                    id: 'stopped',
                    is_gated: false,
                    checks_run: checksRun,
                    runs: { status: 'failed' },
                },
                {
                    id: 'previous',
                    is_gated: isGated,
                    checks_run: checksRun,
                    runs: { status: 'finished' },
                },
            ],
        },
        'previous results': {
            data: [
                {
                    check: 'page-4xx',
                    pages_checked: 4,
                    pages_failed: 2,
                    pages_intended: 0,
                },
            ],
        },
        'previous findings': {
            data: [
                { fingerprint: 'kept', check: 'page-4xx' },
                { fingerprint: 'fixed-1', check: 'page-4xx' },
                { fingerprint: 'fixed-2', check: 'page-4xx' },
            ],
        },
    };
}

async function checksRun() {
    const fake = database();

    await writeScore(fake.client as never, request);

    return scored(fake).checks_run as string[];
}

const request = {
    projectId: 'project',
    auditId: 'audit',
    hasCrossPageChecks: true,
};

function scored(fake: ReturnType<typeof database>) {
    const rpc = fake.queries.find(({ name }) => name === 'score_audit')!;

    return rpc.calls[0][1] as Record<string, unknown> & {
        results: { check: string }[];
    };
}

describe('writeScore', () => {
    it("scores the audit's own pages and findings with the project's marks, and writes the result through score_audit", async () => {
        const fake = database();

        await writeScore(fake.client as never, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: true,
        });

        expect(fake.writes()).toEqual(['rpc score_audit']);

        expect(
            fake.queries.find(({ name }) => name === 'site_pages')!.calls,
        ).toContainEqual(['eq', 'last_audit_id', 'audit']);

        const args = scored(fake);

        expect(args).toMatchObject({
            audit: 'audit',
            score: Math.round(100 - 35 * 0.25),
            is_gated: false,
            severity_3: 1,
            intended: ['finding-2'],
        });

        expect(args.results).toContainEqual({
            check: 'canonical-to-error',
            pages_checked: 1,
            pages_failed: 1,
            pages_intended: 1,
        });
    });

    it('leaves out the checks that compare pages for a stopped audit', async () => {
        const fake = database();

        await writeScore(fake.client as never, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: false,
        });

        const args = scored(fake);

        expect(args.results.map(({ check }) => check)).not.toContain(
            'canonical-to-error',
        );

        expect(args.intended).toEqual([]);
    });

    it('scores no robots or sitemap check when Discover never wrote the robots rules', async () => {
        const fake = database({ audits: { data: { robots_rules: null } } });

        await writeScore(fake.client as never, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: false,
        });

        const checks = scored(fake).results.map(({ check }) => check);

        expect(checks).toContain('page-4xx');
        expect(checks).not.toContain('robots-5xx');
        expect(checks).not.toContain('sitemap-missing');
    });

    it('scores ai-cdn-blocked and pay-per-crawl only when the audit says the CDN test passed', async () => {
        const checksOf = async (cdnTest: string | null) => {
            const fake = database({
                audits: {
                    data: {
                        robots_rules: [],
                        cdn_test: cdnTest,
                        created_at: '2026-10-18T10:00:00Z',
                    },
                },
            });

            await writeScore(fake.client as never, request);

            expect(
                fake.queries.find(({ name }) => name === 'audits')!.calls[0],
            ).toEqual([
                'select',
                'robots_rules, cdn_test, created_at, checks_run',
            ]);

            return scored(fake).results.map(({ check }) => check);
        };

        expect(await checksOf('passed')).toEqual(
            expect.arrayContaining(['ai-cdn-blocked', 'pay-per-crawl']),
        );

        for (const outcome of [
            'browser-refused',
            'bot-refused',
            'spoof-refused',
            null,
        ]) {
            const checks = await checksOf(outcome);

            expect(checks, String(outcome)).not.toContain('ai-cdn-blocked');
            expect(checks, String(outcome)).not.toContain('pay-per-crawl');
            expect(checks, String(outcome)).toContain('markdown-alternate');
        }
    });

    it("reads the project's marks page by page, so none past the first page is dropped", async () => {
        const fake = database();

        await writeScore(fake.client as never, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: true,
        });

        expect(
            fake.queries.find(({ name }) => name === 'audit_marks')!.calls,
        ).toEqual(
            expect.arrayContaining([
                ['order', 'id'],
                ['range', 0, rowsPerRead - 1],
            ]),
        );
    });

    it('writes the checks it ran, and the comparison with the last finished audit on the checks both ran', async () => {
        const ran = await checksRun();

        expect(ran).toEqual(expect.arrayContaining(['page-4xx']));
        expect(ran).not.toContain('ai-cdn-blocked');

        const fake = database(earlierAudits(ran));

        await writeScore(fake.client as never, request);

        expect(
            fake.queries.find((query) => answerOf(query) === 'older audits')!
                .calls[0],
        ).toEqual(['select', 'id, is_gated, checks_run, runs(status)']);

        expect(scored(fake)).toMatchObject({
            checks_run: ran,
            score: 91,
            score_difference: 91 - 83,
            findings_fixed: 2,
            findings_new: 1,
        });
    });

    it('passes over a stopped or failed audit between two finished ones', async () => {
        const fake = database(earlierAudits(await checksRun()));

        await writeScore(fake.client as never, request);

        const readOf = (id: string) =>
            fake.queries.filter(({ calls }) =>
                calls.some(
                    ([method, column, value]) =>
                        method === 'eq' &&
                        column === 'audit_id' &&
                        value === id,
                ),
            );

        expect(readOf('stopped')).toEqual([]);
        expect(readOf('running')).toEqual([]);

        expect(
            readOf('previous')
                .map(({ name }) => name)
                .sort(),
        ).toEqual(['audit_check_results', 'audit_findings']);
    });

    it('reads only the audits created before the one it scores', async () => {
        const fake = database();

        await writeScore(fake.client as never, request);

        const older = fake.queries.find(
            (query) => answerOf(query) === 'older audits',
        )!;

        expect(older.calls).toContainEqual(['eq', 'project_id', 'project']);

        expect(older.calls).toContainEqual([
            'lt',
            'created_at',
            '2026-10-18T10:00:00Z',
        ]);

        expect(older.calls).toContainEqual([
            'order',
            'created_at',
            { ascending: false },
        ]);
    });

    it('scores only the checks the audit stored when it ran, so a check shipped since counts neither as passed nor in the comparison', async () => {
        const ran = await checksRun();
        const stored = ran.filter((check) => check !== 'canonical-to-error');

        const fake = database({
            ...earlierAudits(ran),
            audits: {
                data: {
                    robots_rules: [],
                    created_at: '2026-10-18T10:00:00Z',
                    checks_run: stored,
                },
            },
        });

        await writeScore(fake.client as never, request);

        const args = scored(fake);

        expect(args.checks_run).toEqual(stored);

        expect(args.results.map(({ check }) => check)).not.toContain(
            'canonical-to-error',
        );

        expect(args.findings_new).toBe(0);
    });

    it("scores today's checks for an audit that stored none", async () => {
        const fake = database({
            audits: {
                data: {
                    robots_rules: [],
                    created_at: '2026-10-18T10:00:00Z',
                    checks_run: null,
                },
            },
        });

        await writeScore(fake.client as never, request);

        expect(scored(fake).checks_run).toEqual(await checksRun());

        expect(scored(fake).results.map(({ check }) => check)).toContain(
            'canonical-to-error',
        );
    });

    it('compares against the score of a gated audit capped at 49, on either side', async () => {
        const ran = await checksRun();
        const previousGated = database(earlierAudits(ran, true));

        await writeScore(previousGated.client as never, request);

        expect(scored(previousGated)).toMatchObject({
            score: 91,
            score_difference: 91 - 49,
        });

        const latestGated = database({
            ...earlierAudits(ran),
            audit_findings: {
                data: [
                    {
                        id: 'finding-1',
                        check: 'page-4xx',
                        severity: '3',
                        site_page_id: 'page-1',
                        subject: null,
                        selector: null,
                        fingerprint: 'kept',
                    },
                    {
                        id: 'finding-3',
                        check: 'page-5xx',
                        severity: '3',
                        site_page_id: 'page-0',
                        subject: null,
                        selector: null,
                        fingerprint: 'down',
                    },
                ],
            },
        });

        await writeScore(latestGated.client as never, request);

        expect(scored(latestGated)).toMatchObject({
            is_gated: true,
            score: 49,
            score_difference: 49 - 83,
        });
    });

    it('writes no comparison for the first audit of a project', async () => {
        const fake = database();

        await writeScore(fake.client as never, request);

        expect(scored(fake).score_difference).toBeUndefined();
        expect(scored(fake).findings_fixed).toBeUndefined();
        expect(scored(fake).findings_new).toBeUndefined();
    });

    it('writes no comparison, and reads none of its rows, when the previous audit was scored before it stored the checks it ran', async () => {
        const fake = database(earlierAudits(null));

        await writeScore(fake.client as never, request);

        expect(scored(fake).score_difference).toBeUndefined();
        expect(scored(fake).findings_fixed).toBeUndefined();
        expect(scored(fake).findings_new).toBeUndefined();

        expect(
            fake.queries.some((query) =>
                ['previous findings', 'previous results'].includes(
                    answerOf(query),
                ),
            ),
        ).toBe(false);
    });

    it('throws when score_audit refuses the write', async () => {
        const fake = database({
            score_audit: { error: { message: 'not the latest audit' } },
        });

        await expect(
            writeScore(fake.client as never, {
                projectId: 'project',
                auditId: 'audit',
                hasCrossPageChecks: true,
            }),
        ).rejects.toThrow('not the latest audit');
    });
});

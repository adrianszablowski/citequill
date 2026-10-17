import { describe, expect, it } from 'vitest';

import { writeScore } from '@/features/audit/write-score';
import { fakeSupabase } from '@/lib/supabase/fake';
import { rowsPerRead } from '@/lib/supabase/result';

function database(overrides: Record<string, object> = {}) {
    const answers: Record<string, object> = {
        projects: { data: { domain: 'acme.com', obey_robots: true } },
        audits: { data: { robots_rules: [] } },
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
                },
                {
                    id: 'finding-2',
                    check: 'canonical-to-error',
                    severity: '3',
                    site_page_id: 'page-2',
                    subject: 'https://acme.com/gone',
                    selector: null,
                },
            ],
        },
        audit_marks: {
            data: [{ check: 'canonical-to-error', url: null, selector: null }],
        },
        ...overrides,
    };

    return fakeSupabase(({ name }) => answers[name] ?? {});
}

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

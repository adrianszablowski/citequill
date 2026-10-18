import { refresh } from 'next/cache';
import { getRun, start } from 'workflow/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    markFinding,
    startAudit,
    stopAudit,
    unmarkFinding,
} from '@/features/audit/actions';
import { stalledMessage } from '@/features/audit/format';
import { type Audit, getAudits } from '@/features/audit/queries';
import { auditSite } from '@/features/audit/workflow';
import { writeScore } from '@/features/audit/write-score';
import { fakeSupabase } from '@/lib/supabase/fake';
import { createClient } from '@/lib/supabase/server';

vi.mock('next/navigation', () => {
    return {
        redirect: vi.fn(() => {
            throw new Error('NEXT_REDIRECT');
        }),
    };
});

vi.mock('next/cache', () => {
    return { refresh: vi.fn() };
});

vi.mock('workflow/api', () => {
    return { getRun: vi.fn(), start: vi.fn() };
});

vi.mock('@/features/audit/queries', () => {
    return { getAudits: vi.fn() };
});

vi.mock('@/features/audit/workflow', () => {
    return { auditSite: vi.fn() };
});

vi.mock('@/features/audit/write-score', () => {
    return { writeScore: vi.fn(async () => {}) };
});

vi.mock('@/features/auth/queries', () => {
    return { getCurrentUser: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => {
    return { createClient: vi.fn() };
});

const cancel = vi.fn(async () => {});

function latest(status: Audit['status']): Audit {
    return {
        run: {
            id: 'old-run',
            status: status === 'stalled' ? 'running' : status,
            error: null,
            started_at: '2026-10-17T10:00:00Z',
            progressed_at: null,
            workflow_run_id: 'old-workflow',
            cost_usd: 0,
        },
        audit: null,
        status,
        started: '',
    };
}

function database({ hasEnded = true } = {}) {
    const fake = fakeSupabase(({ name, calls }) => {
        if (name === 'create_audit') {
            return { data: 'new-audit' };
        }

        if (name === 'runs' && calls[0][0] === 'update') {
            return { data: hasEnded ? [{ id: 'old-run' }] : [] };
        }

        return calls[0][0] === 'insert' ? { data: { id: 'new-run' } } : {};
    });

    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    return fake;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRun).mockReturnValue({ cancel } as never);
    vi.mocked(start).mockResolvedValue({ runId: 'new-workflow' } as never);
});

describe('startAudit', () => {
    it('opens a running audit and starts no other', async () => {
        const fake = database();

        vi.mocked(getAudits).mockResolvedValue([latest('running')]);

        await expect(startAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(fake.writes()).toEqual([]);
        expect(start).not.toHaveBeenCalled();
    });

    it('cancels a stalled audit and fails its run with the stall message before it starts the next', async () => {
        const fake = database();

        vi.mocked(getAudits).mockResolvedValue([latest('stalled')]);

        await expect(startAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(getRun).toHaveBeenCalledWith('old-workflow');
        expect(cancel).toHaveBeenCalled();

        expect(fake.queries[0]).toEqual({
            name: 'runs',
            calls: [
                [
                    'update',
                    {
                        status: 'failed',
                        error: stalledMessage,
                        finished_at: expect.any(String),
                    },
                ],
                ['eq', 'id', 'old-run'],
                ['eq', 'status', 'running'],
                ['select', 'id'],
            ],
        });

        expect(fake.writes()).toEqual([
            'update runs',
            'insert runs',
            'rpc create_audit',
            'update runs',
        ]);

        expect(start).toHaveBeenCalledWith(auditSite, [
            'project',
            'new-run',
            'new-audit',
        ]);
    });

    it('still ends a stalled audit whose Workflow run refuses to be cancelled', async () => {
        const fake = database();

        cancel.mockRejectedValueOnce(new Error('The run has already ended.'));
        vi.mocked(getAudits).mockResolvedValue([latest('stalled')]);

        await expect(startAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(fake.writes().slice(0, 2)).toEqual([
            'update runs',
            'insert runs',
        ]);

        expect(start).toHaveBeenCalled();
    });

    it('ends nothing before it starts when the latest audit finished', async () => {
        const fake = database();

        vi.mocked(getAudits).mockResolvedValue([latest('finished')]);

        await expect(startAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(cancel).not.toHaveBeenCalled();
        expect(fake.writes()[0]).toBe('insert runs');
    });
});

describe('stopAudit', () => {
    function running(): Audit {
        return {
            ...latest('running'),
            audit: {
                id: 'audit',
                created_at: '2026-10-17T10:00:00Z',
                pages_read: 120,
                pages_indexable: 0,
                duration_s: null,
                is_partial: false,
                score: null,
                is_gated: false,
                checks_scored: 0,
                checks_total: 0,
                findings_fixed: null,
                findings_new: null,
            },
        };
    }

    it('ends the run, marks the audit partial, then scores the pages read without the checks that compare pages', async () => {
        const fake = database();

        vi.mocked(getAudits).mockResolvedValue([running()]);

        await expect(stopAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(cancel).toHaveBeenCalled();
        expect(fake.writes()).toEqual(['update runs', 'rpc stop_audit']);

        expect(fake.queries[0].calls[0]).toEqual([
            'update',
            {
                status: 'failed',
                error: 'You stopped the audit.',
                finished_at: expect.any(String),
            },
        ]);

        expect(writeScore).toHaveBeenCalledWith(fake.client, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: false,
        });
    });

    it('marks and scores nothing when the run finished on its own before the click landed', async () => {
        const fake = database({ hasEnded: false });

        vi.mocked(getAudits).mockResolvedValue([running()]);

        await expect(stopAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(fake.writes()).toEqual(['update runs']);
        expect(writeScore).not.toHaveBeenCalled();
    });

    it('leaves the stopped audit unscored and still opens the section when the score fails to write', async () => {
        const fake = database();

        vi.mocked(writeScore).mockRejectedValueOnce(new Error('score_audit'));
        vi.mocked(getAudits).mockResolvedValue([running()]);

        await expect(stopAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(fake.writes()).toEqual(['update runs', 'rpc stop_audit']);
    });

    it('stops and scores nothing when the latest audit is not running', async () => {
        const fake = database();

        vi.mocked(getAudits).mockResolvedValue([latest('finished')]);

        await expect(stopAudit('project')).rejects.toThrow('NEXT_REDIRECT');

        expect(fake.writes()).toEqual([]);
        expect(writeScore).not.toHaveBeenCalled();
    });
});

describe('markFinding and unmarkFinding', () => {
    const mark = {
        check: 'page-4xx',
        url: 'https://acme.com/a',
        selector: null,
    };

    function marks({
        audit = { id: 'audit', runs: { status: 'finished' } } as object | null,
        answer = {} as object,
        audits = { data: audit ? [audit] : [] } as object,
    } = {}) {
        const fake = fakeSupabase(({ name }) => {
            if (name === 'audits') {
                return audits;
            }

            return name === 'audit_marks' ? answer : {};
        });

        vi.mocked(createClient).mockResolvedValue(fake.client as never);

        return fake;
    }

    it('marks a finding and recomputes the latest audit with the checks that compare pages', async () => {
        const fake = marks();

        await markFinding('project', mark);

        expect(fake.writes()).toEqual(['insert audit_marks']);

        expect(
            fake.queries.find(({ name }) => name === 'audit_marks')!.calls[0],
        ).toEqual(['insert', { project_id: 'project', ...mark }]);

        expect(writeScore).toHaveBeenCalledWith(fake.client, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: true,
        });

        expect(refresh).toHaveBeenCalled();
    });

    it('recomputes a stopped audit without the checks that compare pages', async () => {
        const fake = marks({
            audit: { id: 'audit', runs: { status: 'failed' } },
        });

        await markFinding('project', mark);

        expect(writeScore).toHaveBeenCalledWith(fake.client, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: false,
        });
    });

    it('treats a mark that already exists as made and still recomputes', async () => {
        marks({ answer: { error: { code: '23505', message: 'duplicate' } } });

        await markFinding('project', mark);

        expect(writeScore).toHaveBeenCalled();
    });

    it('throws on any other refusal of the insert', async () => {
        marks({ answer: { error: { code: '42501', message: 'denied' } } });

        await expect(markFinding('project', mark)).rejects.toThrow('denied');
        expect(writeScore).not.toHaveBeenCalled();
    });

    it('keeps the mark but leaves the scoring to an audit that is still running', async () => {
        const fake = marks({
            audit: { id: 'audit', runs: { status: 'running' } },
        });

        await markFinding('project', mark);

        expect(fake.writes()).toEqual(['insert audit_marks']);
        expect(writeScore).not.toHaveBeenCalled();
    });

    it('unmarks a selector mark by its three keys and recomputes', async () => {
        const fake = marks();

        await unmarkFinding('project', {
            check: 'page-4xx',
            url: null,
            selector: 'img.logo',
        });

        expect(
            fake.queries.find(({ name }) => name === 'audit_marks')!.calls,
        ).toEqual([
            ['delete'],
            ['eq', 'project_id', 'project'],
            ['eq', 'check', 'page-4xx'],
            ['is', 'url', null],
            ['eq', 'selector', 'img.logo'],
        ]);

        expect(writeScore).toHaveBeenCalledWith(fake.client, {
            projectId: 'project',
            auditId: 'audit',
            hasCrossPageChecks: true,
        });
    });

    it('unmarks a URL mark by its URL and an empty selector', async () => {
        const fake = marks();

        await unmarkFinding('project', mark);

        expect(
            fake.queries.find(({ name }) => name === 'audit_marks')!.calls,
        ).toEqual([
            ['delete'],
            ['eq', 'project_id', 'project'],
            ['eq', 'check', 'page-4xx'],
            ['eq', 'url', 'https://acme.com/a'],
            ['is', 'selector', null],
        ]);
    });

    it('throws when the delete is refused and recomputes nothing', async () => {
        marks({ answer: { error: { code: '42501', message: 'denied' } } });

        await expect(unmarkFinding('project', mark)).rejects.toThrow('denied');
        expect(writeScore).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
    });

    it('refuses a check the catalogue does not list and writes nothing', async () => {
        const fake = marks();
        const unknown = { ...mark, check: 'made-up' };

        await expect(markFinding('project', unknown)).rejects.toThrow();
        await expect(unmarkFinding('project', unknown)).rejects.toThrow();

        expect(fake.queries).toEqual([]);
        expect(writeScore).not.toHaveBeenCalled();
    });

    it('throws when the latest audit cannot be read and writes nothing', async () => {
        const fake = marks({
            audits: { error: { message: 'statement timeout' } },
        });

        await expect(markFinding('project', mark)).rejects.toThrow(
            'statement timeout',
        );

        expect(fake.writes()).toEqual([]);
        expect(writeScore).not.toHaveBeenCalled();
    });

    it('writes nothing on a project the user does not own, because its audit reads as no row', async () => {
        const fake = marks({ audit: null });

        await markFinding('project', mark);
        await unmarkFinding('project', mark);

        expect(fake.writes()).toEqual([]);
        expect(writeScore).not.toHaveBeenCalled();
        expect(refresh).not.toHaveBeenCalled();
    });
});

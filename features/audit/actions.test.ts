import { getRun, start } from 'workflow/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startAudit } from '@/features/audit/actions';
import { stalledMessage } from '@/features/audit/format';
import { type Audit, getAudits } from '@/features/audit/queries';
import { auditSite } from '@/features/audit/workflow';
import { fakeSupabase } from '@/lib/supabase/fake';
import { createClient } from '@/lib/supabase/server';

vi.mock('next/navigation', () => {
    return {
        redirect: vi.fn(() => {
            throw new Error('NEXT_REDIRECT');
        }),
    };
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
        },
        audit: null,
        status,
        started: '',
    };
}

function database() {
    const fake = fakeSupabase(({ name, calls }) => {
        if (name === 'create_audit') {
            return { data: 'new-audit' };
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

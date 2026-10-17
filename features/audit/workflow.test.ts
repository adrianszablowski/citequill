import { beforeEach, describe, expect, it, vi } from 'vitest';

import { firstPace } from '@/features/audit/pacing';
import * as steps from '@/features/audit/steps';
import { auditSite } from '@/features/audit/workflow';
import * as runSteps from '@/features/runs/steps';

vi.mock('@/features/audit/steps', () => {
    return {
        discoverSite: vi.fn(),
        readPages: vi.fn(),
        checkSite: vi.fn(async () => {}),
        closeAudit: vi.fn(async () => {}),
    };
});

vi.mock('@/features/runs/steps', () => {
    return {
        failRun: vi.fn(async () => {}),
    };
});

const mocked = vi.mocked(steps);
const runs = vi.mocked(runSteps);

beforeEach(() => {
    vi.clearAllMocks();
    mocked.discoverSite.mockResolvedValue(firstPace);
});

describe('auditSite', () => {
    it('reads while a step reports work left, hands each step the pace of the last, then checks the site and closes', async () => {
        const paces = [1, 2, 3].map((streak) => ({ ...firstPace, streak }));

        mocked.readPages
            .mockResolvedValueOnce({ hasWork: true, pace: paces[0] })
            .mockResolvedValueOnce({ hasWork: true, pace: paces[1] })
            .mockResolvedValueOnce({ hasWork: false, pace: paces[2] });

        await auditSite('project', 'run', 'audit');

        expect(mocked.readPages.mock.calls.map(([, , , pace]) => pace)).toEqual(
            [firstPace, paces[0], paces[1]],
        );

        expect(mocked.checkSite).toHaveBeenCalledWith(
            'project',
            'run',
            'audit',
        );

        expect(mocked.closeAudit).toHaveBeenCalledWith(
            'project',
            'run',
            'audit',
        );

        expect(mocked.checkSite.mock.invocationCallOrder[0]).toBeGreaterThan(
            mocked.readPages.mock.invocationCallOrder[2],
        );

        expect(mocked.closeAudit.mock.invocationCallOrder[0]).toBeGreaterThan(
            mocked.checkSite.mock.invocationCallOrder[0],
        );

        expect(runs.failRun).not.toHaveBeenCalled();
    });

    it('fails the run with the message when a step throws, and neither checks the site nor closes', async () => {
        mocked.readPages.mockRejectedValue(
            new Error('The site stopped answering.'),
        );

        await auditSite('project', 'run', 'audit');

        expect(runs.failRun).toHaveBeenCalledWith(
            'run',
            'The site stopped answering.',
        );

        expect(mocked.checkSite).not.toHaveBeenCalled();
        expect(mocked.closeAudit).not.toHaveBeenCalled();
    });
});

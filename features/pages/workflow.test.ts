import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as steps from '@/features/pages/steps';
import { writePage } from '@/features/pages/workflow';
import * as runSteps from '@/features/runs/steps';

vi.mock('@/features/pages/steps', () => {
    return {
        loadWriteContext: vi.fn(async () => ({
            context: { topic: 'Deload' },
            kindId: 'kind',
            authorId: null,
        })),
        writeBrief: vi.fn(async () => ({ skills: [] })),
        writeDraft: vi.fn(async () => ({ title: 'First' })),
        checkDraft: vi.fn(),
        correctDraft: vi.fn(async () => ({ title: 'Second' })),
        saveDraft: vi.fn(async () => 'page'),
    };
});

vi.mock('@/features/runs/steps', () => {
    return {
        finishRun: vi.fn(async () => {}),
        failRun: vi.fn(async () => {}),
    };
});

const mocked = vi.mocked(steps);
const runs = vi.mocked(runSteps);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('writePage', () => {
    it('saves a clean page after one check and finishes the run', async () => {
        mocked.checkDraft.mockResolvedValue([]);

        await writePage('project', 'run');

        expect(mocked.correctDraft).not.toHaveBeenCalled();

        expect(mocked.saveDraft).toHaveBeenCalledWith(
            'project',
            'run',
            expect.anything(),
            { title: 'First' },
            [],
        );

        expect(runs.finishRun).toHaveBeenCalledWith('run');
    });

    it('corrects once and saves the second check as the note', async () => {
        mocked.checkDraft
            .mockResolvedValueOnce(['Not in the skills: "x"'])
            .mockResolvedValueOnce(['Not in the skills: "y"']);

        await writePage('project', 'run');

        expect(mocked.correctDraft).toHaveBeenCalledTimes(1);
        expect(mocked.checkDraft).toHaveBeenCalledTimes(2);

        expect(mocked.saveDraft).toHaveBeenCalledWith(
            'project',
            'run',
            expect.anything(),
            { title: 'Second' },
            ['Not in the skills: "y"'],
        );
    });

    it('marks the run failed with the message when a step throws', async () => {
        mocked.writeBrief.mockRejectedValueOnce(
            new Error('The brief did not finish its research.'),
        );

        await writePage('project', 'run');

        expect(runs.failRun).toHaveBeenCalledWith(
            'run',
            'The brief did not finish its research.',
        );

        expect(mocked.saveDraft).not.toHaveBeenCalled();
        expect(runs.finishRun).not.toHaveBeenCalled();
    });
});

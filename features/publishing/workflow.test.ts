import { describe, expect, it, vi } from 'vitest';

import * as steps from '@/features/publishing/steps';
import { afterPublish } from '@/features/publishing/workflow';

vi.mock('@/features/publishing/steps', () => {
    return { clearCache: vi.fn(async () => {}) };
});

describe('afterPublish', () => {
    it("clears the project's Content API cache", async () => {
        await afterPublish('project');

        expect(vi.mocked(steps).clearCache).toHaveBeenCalledWith('project');
    });
});

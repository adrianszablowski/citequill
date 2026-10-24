import { clearCache } from '@/features/publishing/steps';

export async function afterPublish(projectId: string) {
    'use workflow';

    await clearCache(projectId);
}

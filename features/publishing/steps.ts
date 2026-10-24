import { clearApiCache } from '@/features/content-api/cache';

export async function clearCache(projectId: string) {
    'use step';

    clearApiCache(projectId);
}

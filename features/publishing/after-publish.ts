import 'server-only';

import { start } from 'workflow/api';

import { apiCacheLife } from '@/features/content-api/cache';
import { afterPublish } from '@/features/publishing/workflow';

export type PublishingAction = keyof typeof unannounced;

export async function startAfterPublish(
    projectId: string,
    action: PublishingAction,
) {
    try {
        await start(afterPublish, [projectId]);

        return null;
    } catch (cause) {
        console.error('The after-publish run did not start.', cause);

        return unannounced[action];
    }
}

const minutes = apiCacheLife.expire / 60;

const unannounced = {
    publish: `The page is live. Citequill could not clear its Content API cache, so your site may not see the change for up to ${minutes} minutes.`,
    unpublish: `The page is unpublished. Citequill could not clear its Content API cache, so your site may read it as live for up to ${minutes} minutes.`,
    settings: `The change is saved. Citequill could not clear its Content API cache, so your site may read the old details for up to ${minutes} minutes.`,
};

import type { Database } from '@/lib/types/database';

export interface Version {
    id: string;
    status: Database['public']['Enums']['page_status'];
    content_hash: string;
    published_pages: { content_hash: string; modified_at: string } | null;
}

export type VersionState = 'draft' | 'live' | 'changed' | 'unpublished';

export function versionState(version: Version): VersionState {
    if (version.status !== 'published') {
        return version.status;
    }

    return version.content_hash === version.published_pages?.content_hash
        ? 'live'
        : 'changed';
}

export function isOutOfDate(version: Version, group: Version[]) {
    const modified = version.published_pages?.modified_at;

    return (
        modified !== undefined &&
        group.some(
            (other) =>
                other.id !== version.id &&
                other.status === 'published' &&
                other.published_pages !== null &&
                Date.parse(other.published_pages.modified_at) >
                    Date.parse(modified),
        )
    );
}

export function versionsDiverge(group: Version[]) {
    return (
        new Set(group.map(versionState)).size > 1 ||
        group.some((version) => isOutOfDate(version, group))
    );
}

export const stateButtons: Record<VersionState, PublishingButton[]> = {
    draft: ['publish'],
    unpublished: ['publish'],
    live: ['unpublish'],
    changed: ['publish-changes', 'discard', 'unpublish'],
};

export const stateNames: Record<VersionState, string> = {
    draft: 'Draft',
    live: 'Live',
    changed: 'Live with unpublished changes',
    unpublished: 'Unpublished',
};

type PublishingButton = 'publish' | 'publish-changes' | 'discard' | 'unpublish';

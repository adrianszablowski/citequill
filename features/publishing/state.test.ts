import { describe, expect, it } from 'vitest';

import {
    isOutOfDate,
    stateButtons,
    type Version,
    versionsDiverge,
    versionState,
} from '@/features/publishing/state';

function version(
    id: string,
    status: Version['status'],
    published: { hash?: string; modified?: string } | null = null,
): Version {
    return {
        id,
        status,
        content_hash: 'copy',
        published_pages: published && {
            content_hash: published.hash ?? 'copy',
            modified_at: published.modified ?? '2026-10-20T10:00:00Z',
        },
    };
}

describe('versionState', () => {
    it('names a draft and an unpublished page by their status', () => {
        expect(versionState(version('a', 'draft'))).toBe('draft');

        expect(versionState(version('a', 'unpublished', {}))).toBe(
            'unpublished',
        );
    });

    it('tells a live page from one whose copy differs from its published version', () => {
        expect(versionState(version('a', 'published', {}))).toBe('live');

        expect(versionState(version('a', 'published', { hash: 'older' }))).toBe(
            'changed',
        );
    });
});

describe('stateButtons', () => {
    it('offers Publish on a draft and an unpublished page', () => {
        expect(stateButtons.draft).toEqual(['publish']);
        expect(stateButtons.unpublished).toEqual(['publish']);
    });

    it('offers Unpublish on a live page, and Publish changes and Discard changes when its copy differs', () => {
        expect(stateButtons.live).toEqual(['unpublish']);

        expect(stateButtons.changed).toEqual([
            'publish-changes',
            'discard',
            'unpublish',
        ]);
    });
});

describe('isOutOfDate', () => {
    const older = version('pl', 'published', {
        modified: '2026-10-20T10:00:00Z',
    });

    const newer = version('en', 'published', {
        modified: '2026-10-21T10:00:00.5+00:00',
    });

    it('marks a version when another live version of its group has a later content date', () => {
        expect(isOutOfDate(older, [older, newer])).toBe(true);
        expect(isOutOfDate(newer, [older, newer])).toBe(false);
    });

    it('leaves the mark off when the later version is no longer live, and on a version never published', () => {
        const gone = { ...newer, status: 'unpublished' as const };

        expect(isOutOfDate(older, [older, gone])).toBe(false);
        expect(isOutOfDate(version('de', 'draft'), [newer])).toBe(false);
    });
});

describe('versionsDiverge', () => {
    it('holds for versions in different states', () => {
        expect(
            versionsDiverge([
                version('en', 'published', {}),
                version('pl', 'draft'),
            ]),
        ).toBe(true);

        expect(
            versionsDiverge([
                version('en', 'published', {}),
                version('pl', 'published', { hash: 'older' }),
            ]),
        ).toBe(true);
    });

    it('holds when one version carries the mark', () => {
        expect(
            versionsDiverge([
                version('en', 'published', {
                    modified: '2026-10-21T10:00:00Z',
                }),
                version('pl', 'published', {}),
            ]),
        ).toBe(true);
    });

    it('does not hold for one version or for versions live alike', () => {
        expect(versionsDiverge([version('en', 'draft')])).toBe(false);

        expect(
            versionsDiverge([
                version('en', 'published', {}),
                version('pl', 'published', {}),
            ]),
        ).toBe(false);
    });
});

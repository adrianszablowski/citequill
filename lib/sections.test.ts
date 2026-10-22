import { describe, expect, it } from 'vitest';

import {
    pageTitle,
    projectSections,
    sectionHref,
    settingsHref,
    settingsPages,
} from '@/lib/sections';

describe('pageTitle', () => {
    it('names a section of a project', () => {
        expect(pageTitle('/projects/abc/analytics')).toBe('Analytics');
    });

    it('names Settings on each of its pages', () => {
        expect(pageTitle('/projects/abc/settings/audit')).toBe('Settings');
    });

    it('has no title for an unknown path', () => {
        expect(pageTitle('/projects/abc/other')).toBeUndefined();
        expect(pageTitle('/login')).toBeUndefined();
    });
});

describe('projectSections', () => {
    it('lists the six sections in the order of the dashboard', () => {
        expect(projectSections.map((section) => section.title)).toEqual([
            'Pages',
            'Skills',
            'Audit',
            'Analytics',
            'Reports',
            'Settings',
        ]);
    });
});

describe('sectionHref', () => {
    it('builds the path of a section', () => {
        expect(sectionHref('abc', 'pages')).toBe('/projects/abc/pages');
    });
});

describe('settingsPages', () => {
    it('lists General and Audit, with General at the bare Settings address', () => {
        expect(
            settingsPages.map((page) => [
                page.title,
                settingsHref('abc', page.segment),
            ]),
        ).toEqual([
            ['General', '/projects/abc/settings'],
            ['Audit', '/projects/abc/settings/audit'],
        ]);
    });
});

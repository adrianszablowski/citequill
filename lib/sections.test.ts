import { describe, expect, it } from 'vitest';

import { pageTitle, projectSections, sectionHref } from '@/lib/sections';

describe('pageTitle', () => {
    it('names a section of a project', () => {
        expect(pageTitle('/projects/abc/analytics')).toBe('Analytics');
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

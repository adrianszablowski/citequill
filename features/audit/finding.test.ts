import { describe, expect, it } from 'vitest';

import {
    fingerprint,
    findingRows,
    selectorOf,
    snippetLength,
    snippetOf,
} from '@/features/audit/finding';

const context = {
    projectId: 'project',
    auditId: 'audit',
    pageIds: new Map([['https://acme.com/a', 'page-a']]),
};

describe('findingRows', () => {
    it('takes the severity from the catalogue and the page from its URL', () => {
        const [page, site] = findingRows(
            [
                { check: 'page-4xx', url: 'https://acme.com/a' },
                {
                    check: 'robots-5xx',
                    url: null,
                    subject: 'https://acme.com/robots.txt',
                },
            ],
            context,
        );

        expect(page).toMatchObject({
            audit_id: 'audit',
            project_id: 'project',
            site_page_id: 'page-a',
            check: 'page-4xx',
            severity: '3',
            subject: null,
            selector: null,
            snippet: null,
            detail: null,
        });

        expect(site).toMatchObject({
            site_page_id: null,
            severity: '3',
            subject: 'https://acme.com/robots.txt',
        });
    });

    it('gives the same finding the same fingerprint in every audit, and another page another one', () => {
        const [one] = findingRows(
            [{ check: 'page-4xx', url: 'https://acme.com/a' }],
            context,
        );

        const [again] = findingRows(
            [{ check: 'page-4xx', url: 'https://acme.com/a' }],
            { ...context, auditId: 'next-audit' },
        );

        expect(one.fingerprint).toMatch(/^[0-9a-f]{64}$/);
        expect(again.fingerprint).toBe(one.fingerprint);

        expect(fingerprint('page-4xx', 'page-b', null, null)).not.toBe(
            one.fingerprint,
        );

        expect(fingerprint('a', null, 'b', null)).not.toBe(
            fingerprint('a', null, null, 'b'),
        );
    });

    it('keeps a short snippet of the element and never the page', () => {
        const [row] = findingRows(
            [
                {
                    check: 'canonical-outside-head',
                    url: 'https://acme.com/a',
                    snippet: `<link rel="canonical"\n   href="${'x'.repeat(500)}">`,
                },
            ],
            context,
        );

        expect(row.snippet).toHaveLength(snippetLength);
        expect(row.snippet).toMatch(/^<link rel="canonical" href="x+…$/);
    });
});

describe('selectorOf', () => {
    it('builds the selector from the tag, the id and the classes, so one element has one selector on every page', () => {
        expect(
            selectorOf({
                name: 'img',
                attribs: { id: 'logo', class: ' brand  wide ', src: '/a.png' },
            }),
        ).toBe('img#logo.brand.wide');

        expect(
            selectorOf({ name: 'link', attribs: { rel: 'canonical' } }),
        ).toBe('link');
    });
});

describe('snippetOf', () => {
    it('collapses whitespace and leaves a short snippet whole', () => {
        expect(snippetOf('<a\n  href="/x">  X </a>')).toBe(
            '<a href="/x"> X </a>',
        );
    });
});

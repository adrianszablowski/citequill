import { describe, expect, it } from 'vitest';

import {
    cappedPerPage,
    fingerprint,
    findingRows,
    isTemplateSelector,
    selectorOf,
    snippetLength,
    snippetOf,
} from '@/features/audit/finding';
import {
    assetWeightChecks,
    heavyAssetBytes,
} from '@/features/audit/performance-checks';

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

    it('tells the two halves of assets-heavy on one home page apart, and keeps the fingerprint of the files half', () => {
        const [files, bytes] = findingRows(
            [
                {
                    check: 'assets-heavy',
                    url: 'https://acme.com/a',
                    detail: { reason: 'files', files: 60 },
                },
                ...assetWeightChecks(
                    ['https://acme.com/a'],
                    [
                        {
                            linked_from: ['https://acme.com/a'],
                            content_length: heavyAssetBytes + 1,
                        },
                    ],
                ),
            ],
            context,
        );

        expect(bytes).toMatchObject({ subject: null, selector: null });
        expect(bytes.fingerprint).not.toBe(files.fingerprint);

        expect(files.fingerprint).toBe(
            fingerprint('assets-heavy', 'page-a', null, null),
        );
    });

    it('keeps the fingerprint of every other finding the hash of its check, page, subject and selector', () => {
        const [row] = findingRows(
            [
                {
                    check: 'link-broken-internal',
                    url: 'https://acme.com/a',
                    subject: 'https://acme.com/gone',
                    selector: 'a.cta',
                    detail: { reason: 'status', status: 404 },
                },
            ],
            context,
        );

        expect(row.fingerprint).toBe(
            '87db53a723792f38f46dbc94c064db55dee76c7bd152f75b5449612186a42c37',
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

describe('cappedPerPage', () => {
    it('drops a copy of a finding, never another half of it', () => {
        const files = {
            check: 'assets-heavy',
            url: 'https://acme.com/a',
            detail: { reason: 'files' },
        } as const;

        const bytes = { ...files, detail: { reason: 'bytes' }, half: 'bytes' };

        expect(cappedPerPage([files, files, bytes, bytes])).toEqual([
            files,
            bytes,
        ]);
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

describe('isTemplateSelector', () => {
    it('holds for a selector with an id or a class, which names one element of the template', () => {
        expect(isTemplateSelector('img#logo.brand')).toBe(true);
        expect(isTemplateSelector('a.read-more')).toBe(true);
    });

    it('fails for a bare tag, which would match every such element on the site', () => {
        expect(isTemplateSelector('a')).toBe(false);
        expect(isTemplateSelector('img')).toBe(false);
    });
});

describe('snippetOf', () => {
    it('collapses whitespace and leaves a short snippet whole', () => {
        expect(snippetOf('<a\n  href="/x">  X </a>')).toBe(
            '<a href="/x"> X </a>',
        );
    });
});

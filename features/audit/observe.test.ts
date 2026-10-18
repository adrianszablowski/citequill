import { describe, expect, it } from 'vitest';

import {
    googlebotDirectives,
    headerCanonical,
    isIndexable,
    observePage,
    observeRead,
    type Read,
    type ReadContext,
} from '@/features/audit/observe';
import { thinPageWords } from '@/features/audit/page';
import { type QueueEntry, siteHosts } from '@/features/audit/queue';
import type { Fetched, Hop } from '@/features/crawl/fetch';

const context: ReadContext = {
    projectId: 'project',
    auditId: 'audit',
    locales: [{ locale: 'en', base_url: 'https://acme.com', is_default: true }],
    hosts: siteHosts('acme.com', ['https://acme.com']),
    pageIds: new Map([['https://acme.com/blog/post', 'page-1']]),
};

function entry(url: string, depth: number | null = 1): QueueEntry {
    return { url, depth, state: 'queued', in_sitemap: true, inbound_links: 0 };
}

function page(
    url: string,
    links: string[],
    hops: Hop[] = [{ url, status: 200 }],
) {
    const body = links.map((href) => `<a href="${href}">link</a>`).join('');

    return {
        ok: true,
        status: hops.at(-1)!.status,
        url: hops.at(-1)!.url,
        headers: new Headers({ 'content-type': 'text/html' }),
        body: `<html><body>${body}</body></html>`,
        isTruncated: false,
        hops,
    } satisfies Fetched;
}

function observe(read: Read) {
    return observeRead(read, context);
}

describe('observeRead', () => {
    it('takes the links on the site one click deeper, and never a link of a page to itself', () => {
        const url = 'https://acme.com/a';

        const { row, candidates } = observe({
            entry: entry(url),
            outcome: page(url, [
                '/a',
                '/a#top',
                '/b',
                'https://www.acme.com/c',
                'https://other.com/d',
            ]),
        });

        expect(row).toMatchObject({
            url,
            locale: 'en',
            status_code: 200,
            is_blocked: false,
        });

        expect(candidates).toEqual([
            { url: 'https://acme.com/b', depth: 2, inbound: 1 },
            { url: 'https://www.acme.com/c', depth: 2, inbound: 1 },
        ]);
    });

    it('queues the page a redirect lands on at the depth of the URL that redirected, and none of its links', () => {
        const url = 'https://acme.com/old';

        const { row, candidates } = observe({
            entry: entry(url, 2),
            outcome: page(
                url,
                ['/elsewhere'],
                [
                    { url, status: 301 },
                    { url: 'https://www.acme.com/new', status: 200 },
                ],
            ),
        });

        expect(row).toMatchObject({
            status_code: 301,
            redirect_to: 'https://www.acme.com/new',
        });

        expect(candidates).toEqual([
            { url: 'https://www.acme.com/new', depth: 2 },
        ]);

        const offSite = observe({
            entry: entry(url),
            outcome: page(
                url,
                [],
                [
                    { url, status: 301 },
                    { url: 'https://other.com/', status: 200 },
                ],
            ),
        });

        expect(offSite.candidates).toEqual([]);
    });

    it('matches a page Citequill published by its path, with or without the trailing slash', () => {
        const pageId = (url: string) =>
            observe({ entry: entry(url), outcome: page(url, []) }).row.page_id;

        expect(pageId('https://acme.com/blog/post')).toBe('page-1');
        expect(pageId('https://acme.com/blog/post/')).toBe('page-1');
        expect(pageId('https://acme.com/blog/other')).toBeNull();
    });

    it('records the first description and the images the checks list, decorative and header ones included', () => {
        const url = 'https://acme.com/a';

        const { row } = observe({
            entry: entry(url),
            outcome: {
                ...page(url, []),
                body: '<html><head><meta name="description" content=" Plans. "><meta name="description" content="Other"></head><body><header><img src="/logo.png" alt="Acme"></header><img src="/line.png" alt=""><img src="/pixel.gif" alt="" width="1" height="1"><svg aria-hidden="true"></svg></body></html>',
            },
        });

        expect(row).toMatchObject({ description: 'Plans.', image_count: 2 });
    });

    it(`records the SimHash of a main text of ${thinPageWords} words or more, which near-duplicate compares, and none of a shorter one`, () => {
        const url = 'https://acme.com/a';

        const simhashOf = (count: number) =>
            observe({
                entry: entry(url),
                outcome: {
                    ...page(url, []),
                    body: `<html><body><main>${Array.from({ length: count }, (_, i) => `word${i}`).join(' ')}</main></body></html>`,
                },
            }).row.body_simhash;

        expect(simhashOf(thinPageWords)).toMatch(/^[0-9a-f]{16}$/);
        expect(simhashOf(thinPageWords - 1)).toBeNull();
    });

    it('records a blocked or failed read as a URL that did not answer, with what the queue knew', () => {
        const url = 'https://acme.com/private';

        for (const [outcome, isBlocked] of [
            ['blocked', true],
            [new Error('timeout'), false],
        ] as const) {
            const { row, candidates } = observe({ entry: entry(url), outcome });

            expect(row).toMatchObject({
                status_code: null,
                final_url: null,
                is_indexable: false,
                is_blocked: isBlocked,
                title: null,
                body_hash: null,
                body_simhash: null,
                description: null,
                image_count: 0,
                click_depth: 1,
                in_sitemap: true,
            });

            expect(candidates).toEqual([]);
        }
    });
});

describe('googlebotDirectives', () => {
    it('reads the robots and googlebot meta and the header lines for Googlebot or every crawler', () => {
        expect(
            googlebotDirectives(
                ['NOINDEX, follow'],
                'googlebot: nosnippet, otherbot: noarchive, notranslate',
            ),
        ).toEqual(['noindex', 'follow', 'nosnippet']);

        expect(googlebotDirectives([], 'noindex')).toEqual(['noindex']);
    });

    it('keeps a directive with a value whole instead of reading it as a crawler', () => {
        expect(
            googlebotDirectives(
                [],
                'unavailable_after: 25 Jun 2030 15:00:00 PST, max-snippet: 50',
            ),
        ).toEqual([
            'unavailable_after: 25 jun 2030 15:00:00 pst',
            'max-snippet: 50',
        ]);
    });
});

describe('isIndexable', () => {
    it('needs a 200 and no noindex or none', () => {
        expect(isIndexable(200, ['follow'])).toBe(true);
        expect(isIndexable(200, ['noindex'])).toBe(false);
        expect(isIndexable(200, ['none'])).toBe(false);
        expect(isIndexable(404, [])).toBe(false);
        expect(isIndexable(301, [])).toBe(false);
    });
});

describe('observePage', () => {
    it('describes a page that answered by itself', () => {
        expect(
            observePage({
                hops: [{ url: 'https://acme.com/a', status: 200 }],
                title: 'A',
                canonical: 'https://acme.com/a',
                directives: [],
            }),
        ).toEqual({
            status_code: 200,
            final_url: 'https://acme.com/a',
            redirect_to: null,
            is_indexable: true,
            canonical_url: 'https://acme.com/a',
            title: 'A',
        });
    });

    it('describes a redirect by its own answer, never by the page it lands on', () => {
        expect(
            observePage({
                hops: [
                    { url: 'https://acme.com/a', status: 301 },
                    { url: 'https://acme.com/a/', status: 302 },
                    { url: 'https://www.acme.com/a/', status: 200 },
                ],
                title: 'A',
                canonical: null,
                directives: [],
            }),
        ).toEqual({
            status_code: 301,
            final_url: 'https://www.acme.com/a/',
            redirect_to: 'https://acme.com/a/',
            is_indexable: false,
            canonical_url: null,
            title: null,
        });
    });

    it('marks a page that did not answer as not indexable', () => {
        expect(observePage(null)).toMatchObject({
            status_code: null,
            is_indexable: false,
        });
    });
});

describe('headerCanonical', () => {
    it('reads the canonical a Link header names, among other links', () => {
        expect(
            headerCanonical(
                '<https://cdn.acme.com/a.css>; rel=preload, </pricing>; rel="canonical"',
                'https://acme.com/pricing?ref=x',
            ),
        ).toBe('https://acme.com/pricing');

        expect(
            headerCanonical(
                '<https://acme.com/a.css>; rel=preload',
                'https://acme.com/',
            ),
        ).toBeNull();

        expect(headerCanonical(null, 'https://acme.com/')).toBeNull();
    });
});

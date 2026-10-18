import { describe, expect, it } from 'vitest';

import {
    type HeuristicContext,
    heuristicChecks,
} from '@/features/audit/heuristic-checks';
import { readAuditPage } from '@/features/audit/page';
import { siteHosts } from '@/features/audit/queue';
import type { TablesInsert } from '@/lib/types/database';

const context: HeuristicContext = {
    hosts: siteHosts('acme.com', ['https://acme.com']),
    isDisallowed: () => false,
};

const words = (count: number, word = (i: number) => `word${i}`) =>
    Array.from({ length: count }, (_, i) => word(i)).join(' ');

interface Page {
    body?: string;
    head?: string;
    canonical?: string | null;
    isIndexable?: boolean;
    directives?: string[];
}

function check(
    path: string,
    {
        body = `<main>${words(200)}</main>`,
        head = '',
        canonical,
        isIndexable = true,
        directives = [],
    }: Page = {},
    overrides: Partial<HeuristicContext> = {},
) {
    const url = `https://acme.com${path}`;

    const row: TablesInsert<'site_pages'> = {
        project_id: 'project',
        url,
        is_indexable: isIndexable,
        canonical_url: canonical === undefined ? url : canonical,
    };

    return heuristicChecks(
        url,
        row,
        readAuditPage(
            `<html><head>${head}</head><body>${body}</body></html>`,
            url,
        ),
        directives,
        { ...context, ...overrides },
    );
}

function checks(...args: Parameters<typeof check>) {
    return check(...args).map((finding) => finding.check);
}

describe('heuristicChecks', () => {
    it('finds nothing on an indexable content page', () => {
        expect(checks('/pricing')).toEqual([]);
    });

    it('reports an indexable search page that robots.txt does not disallow', () => {
        expect(checks('/search?q=shoes')).toEqual(['search-results-indexable']);

        expect(checks('/szukaj', { isIndexable: false })).toEqual([]);

        expect(
            checks('/search?q=shoes', {}, { isDisallowed: () => true }),
        ).toEqual([]);
    });

    it('notes an indexable print, login, thank-you or cart page', () => {
        expect(checks('/koszyk')).toEqual(['utility-indexable']);
        expect(checks('/article?print=1')).toEqual(['utility-indexable']);
        expect(checks('/login', { isIndexable: false })).toEqual([]);
    });

    it('reports a later page of a series with noindex, or a canonical to the series or its first page', () => {
        expect(
            check('/blog/page/3', {
                isIndexable: false,
                directives: ['noindex'],
            }),
        ).toMatchObject([
            {
                check: 'pagination-canonical',
                detail: {
                    reason: 'noindex',
                    series: 'https://acme.com/blog',
                },
            },
        ]);

        for (const canonical of [
            'https://acme.com/blog?sort=new',
            'https://acme.com/blog?sort=new&page=1',
        ]) {
            expect(
                check('/blog?sort=new&page=2', { canonical }),
                canonical,
            ).toMatchObject([
                {
                    check: 'pagination-canonical',
                    subject: canonical,
                    detail: {
                        reason: 'canonical',
                        series: 'https://acme.com/blog?sort=new',
                    },
                },
            ]);
        }
    });

    it('leaves the first page of a series, and a later page that is its own canonical, alone', () => {
        expect(
            checks('/blog/page/1', { canonical: 'https://acme.com/blog' }),
        ).toEqual([]);

        expect(checks('/blog/page/2')).toEqual([]);
    });

    it('reports a page with an internal link whose fragment is a page number, and not a foreign one', () => {
        expect(
            check('/blog', {
                body: `<main>${words(200)}</main><a href="https://other.com/#page=2">x</a><a href="#strona=2">2</a>`,
            }),
        ).toEqual([
            {
                check: 'pagination-canonical',
                url: 'https://acme.com/blog',
                subject: '#strona=2',
                snippet: '#strona=2',
                detail: { reason: 'fragment' },
            },
        ]);
    });

    it('keeps the noindex and fragment findings of one page apart by their subject', () => {
        const findings = check('/blog/page/3', {
            isIndexable: false,
            directives: ['noindex'],
            body: `<main>${words(200)}</main><a href="#page=4">4</a>`,
        });

        expect(findings).toMatchObject([
            { detail: { reason: 'noindex' } },
            { detail: { reason: 'fragment' } },
        ]);

        expect(findings[0].subject).not.toBe(findings[1].subject);
    });

    it('reports an indexable, self-canonical facet page that says it has no results', () => {
        const empty = { body: '<main>Shoes. Brak wyników.</main>' };

        expect(check('/shoes?color=red', empty)).toMatchObject([
            { check: 'facets-indexable', detail: { reason: 'empty' } },
        ]);

        expect(
            checks('/shoes?color=red', {
                ...empty,
                canonical: 'https://acme.com/shoes',
            }),
        ).toEqual([]);

        expect(checks('/shoes', empty)).toEqual([]);

        expect(
            checks('/shoes?color=red', {
                body: `<main>${words(120)} no results</main>`,
            }),
        ).toEqual([]);
    });

    it('reads the no-results phrase of a facet page in its main text, not its footer', () => {
        const footer = '<footer>0 results in your basket</footer>';

        expect(
            checks('/shoes?color=red', {
                body: `<main>Red shoes in stock.</main>${footer}`,
            }),
        ).toEqual([]);

        expect(
            checks('/shoes?color=red', {
                body: `<main>Red shoes: 0 results.</main>${footer}`,
            }),
        ).toEqual(['facets-indexable']);
    });

    it('reports an indexable page linking inside the site with a tracking parameter, once, with the first such link', () => {
        expect(
            check('/pricing', {
                body: `<main>${words(200)}</main><a href="https://other.com/?utm_source=a">x</a><a href="/a?gclid=1">a</a><a href="/b?utm_medium=b">b</a>`,
            }),
        ).toEqual([
            {
                check: 'param-duplicates',
                url: 'https://acme.com/pricing',
                subject: 'https://acme.com/a?gclid=1',
                snippet: 'https://acme.com/a?gclid=1',
                detail: { reason: 'tracking', parameter: 'gclid' },
            },
        ]);
    });

    it('reports each hidden block that repeats a word, on any page that answered', () => {
        const stuffed = words(50, () => 'cheap shoes warsaw');

        const findings = check('/pricing', {
            isIndexable: false,
            body: `<main>${words(200)}</main><div class="seo" style="text-indent:-9999px">${stuffed}</div><div style="text-indent:-9999px">${words(60)}</div>`,
        });

        expect(findings).toMatchObject([
            {
                check: 'spam-pattern',
                selector: 'div.seo',
                detail: { words: 150, word: 'cheap' },
            },
        ]);

        expect(findings[0].snippet).toMatch(/^<div class="seo"/);
    });

    it('reports a block moved off screen or at zero font size or opacity, and not one with display:none, as an accordion renders', () => {
        const hiddenBy = (style: string) =>
            checks('/pricing', {
                body: `<main>${words(200)}</main><div style="${style}">${words(20, () => 'cheap shoes warsaw')}</div>`,
            });

        expect(hiddenBy('display:none')).toEqual([]);

        expect(hiddenBy('position:absolute; left:-9999px')).toEqual([
            'spam-pattern',
        ]);

        expect(hiddenBy('font-size:0')).toEqual(['spam-pattern']);
        expect(hiddenBy('opacity:0')).toEqual(['spam-pattern']);
    });

    it('reports an indexable page whose stylesheet or script robots.txt disallows, once with the count', () => {
        const head =
            '<link rel="stylesheet" href="/assets/a.css"><script src="/assets/a.js"></script><script src="/app.js"></script>';

        expect(
            check(
                '/pricing',
                { head },
                { isDisallowed: (url) => url.includes('/assets/') },
            ),
        ).toEqual([
            {
                check: 'robots-assets-blocked',
                url: 'https://acme.com/pricing',
                subject: 'https://acme.com/assets/a.css',
                detail: { blocked: 2 },
            },
        ]);

        expect(
            checks(
                '/pricing',
                { head, isIndexable: false },
                { isDisallowed: () => true },
            ),
        ).toEqual([]);
    });
});

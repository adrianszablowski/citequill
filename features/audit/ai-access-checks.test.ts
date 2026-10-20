import { describe, expect, it } from 'vitest';

import { aiAccessChecks } from '@/features/audit/ai-access-checks';
import { googlebotDirectives } from '@/features/audit/observe';
import { readAuditPage } from '@/features/audit/page';
import type { Fetched } from '@/features/crawl/fetch';

const url = 'https://acme.com/guide';

const article = 'A guide long enough to be the main text of the page. '.repeat(
    10,
);

function checks(
    head: string,
    {
        header = null,
        body = `<main><p>${article}</p></main>`,
        blocked = [],
    }: { header?: string | null; body?: string; blocked?: string[] } = {},
) {
    const page = readAuditPage(
        `<html><head>${head}</head><body>${body}</body></html>`,
        url,
    );

    const fetched = {
        headers: new Headers(header === null ? {} : { 'x-robots-tag': header }),
    } as Fetched;

    return aiAccessChecks(
        url,
        fetched,
        page,
        googlebotDirectives(page.robotsMeta, header),
        { aiSearchBlocked: () => blocked },
    );
}

function ids(...args: Parameters<typeof checks>) {
    return checks(...args).map((finding) => finding.check);
}

const robots = (content: string, name = 'robots') =>
    `<meta name="${name}" content="${content}">`;

describe('aiAccessChecks', () => {
    it('finds nothing on a page with the defaults Yoast and Rank Math write', () => {
        expect(
            ids(
                robots(
                    'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
                ),
            ),
        ).toEqual([]);

        expect(
            ids(
                robots(
                    'follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large',
                ),
            ),
        ).toEqual([]);
    });

    it('names the AI search agents robots.txt disallows the page for', () => {
        expect(checks('', { blocked: ['OAI-SearchBot', 'Applebot'] })).toEqual([
            {
                check: 'ai-search-bots-blocked',
                url,
                detail: { agents: ['OAI-SearchBot', 'Applebot'] },
            },
        ]);
    });

    it('reports nosnippet and max-snippet:0 for Googlebot, by tag or header, and not for another crawler', () => {
        expect(checks(robots('nosnippet'))).toEqual([
            {
                check: 'nosnippet',
                url,
                detail: { reason: 'directive', directives: ['nosnippet'] },
            },
        ]);

        expect(ids(robots('max-snippet:0', 'googlebot'))).toEqual([
            'nosnippet',
        ]);

        expect(ids('', { header: 'googlebot: max-snippet: 0' })).toEqual([
            'nosnippet',
        ]);

        expect(ids(robots('nosnippet', 'bingbot'))).toEqual([]);
        expect(ids('', { header: 'otherbot: nosnippet' })).toEqual([]);
    });

    it('reports max-snippet from 1 to 159, and leaves -1, 0, 160 and a value that is not a number to other checks', () => {
        for (const limit of ['1', '159']) {
            expect(checks(robots(`max-snippet:${limit}`)), limit).toEqual([
                {
                    check: 'max-snippet-small',
                    url,
                    detail: { directives: [`max-snippet:${limit}`] },
                },
            ]);
        }

        expect(ids(robots('max-snippet:-1'))).toEqual([]);
        expect(ids(robots('max-snippet:0'))).toEqual(['nosnippet']);
        expect(ids(robots('max-snippet:160'))).toEqual([]);
        expect(ids(robots('max-snippet: lots'))).toEqual([]);
    });

    it('reports data-nosnippet on a div that is the main element or sits around it', () => {
        expect(
            checks('', {
                body: `<div class="entry" role="main" data-nosnippet><p>${article}</p></div>`,
            }),
        ).toEqual([
            {
                check: 'nosnippet',
                url,
                selector: 'div.entry',
                detail: { reason: 'data-nosnippet' },
            },
        ]);

        expect(
            ids('', {
                body: `<div data-nosnippet><main><p>${article}</p></main></div>`,
            }),
        ).toEqual(['nosnippet']);
    });

    it('leaves a data-nosnippet inside the main content, however much text it holds, as a comments block carries it', () => {
        expect(
            ids('', {
                body: `<main><p>${article}</p><div data-nosnippet>Related posts</div></main>`,
            }),
        ).toEqual([]);

        expect(
            ids('', {
                body: `<main><div class="entry" data-nosnippet><p>${article}</p></div></main>`,
            }),
        ).toEqual([]);

        expect(
            ids('', {
                body: `<main><p>A short post.</p><section id="comments" data-nosnippet>${article}</section></main>`,
            }),
        ).toEqual([]);
    });

    it('leaves a cookie banner with data-nosnippet out of the main content of a page without main, as Complianz renders it', () => {
        const banner = 'We use cookies to improve your experience. '.repeat(30);

        const body = `<div class="cmplz-cookiebanner" role="dialog" aria-modal="true" data-nosnippet><p>${banner}</p></div><div class="content"><p>A short page.</p></div>`;

        expect(
            readAuditPage(`<html><body>${body}</body></html>`, url).mainText,
        ).toBe('A short page.');

        expect(ids('', { body })).toEqual([]);
    });

    it('leaves data-nosnippet on main or on body, as Google reads it on span, div and section only', () => {
        expect(
            ids('', { body: `<main data-nosnippet><p>${article}</p></main>` }),
        ).toEqual([]);

        expect(
            aiAccessChecks(
                url,
                { headers: new Headers() } as Fetched,
                readAuditPage(
                    `<html><body data-nosnippet><main><p>${article}</p></main></body></html>`,
                    url,
                ),
                [],
                { aiSearchBlocked: () => [] },
            ),
        ).toEqual([]);

        expect(
            aiAccessChecks(
                url,
                { headers: new Headers() } as Fetched,
                readAuditPage(
                    `<html><body data-nosnippet><p>${article}</p></body></html>`,
                    url,
                ),
                [],
                { aiSearchBlocked: () => [] },
            ),
        ).toEqual([]);
    });

    it('leaves max-snippet-small out when a directive already gave nosnippet, which overrides the length', () => {
        expect(ids(robots('nosnippet, max-snippet:50'))).toEqual(['nosnippet']);

        expect(
            ids(robots('max-snippet:50'), {
                body: `<div data-nosnippet><main><p>${article}</p></main></div>`,
            }),
        ).toEqual(['nosnippet', 'max-snippet-small']);
    });

    it('reads noarchive and nocache for Bingbot from the robots and bingbot tags and a header for Bingbot or every crawler', () => {
        expect(checks(robots('noarchive'))).toEqual([
            {
                check: 'noarchive',
                url,
                detail: { meta: ['noarchive'], header: [] },
            },
        ]);

        expect(ids(robots('noarchive', 'bingbot'))).toEqual(['noarchive']);

        expect(ids('', { header: 'bingbot: noarchive' })).toEqual([
            'noarchive',
        ]);

        expect(checks('', { header: 'nocache' })).toEqual([
            {
                check: 'nocache',
                url,
                detail: { meta: [], header: ['nocache'] },
            },
        ]);

        expect(ids(robots('nocache', 'BINGBOT'))).toEqual(['nocache']);
    });

    it('reads noarchive with nocache as nocache alone, as Bing does', () => {
        expect(ids(robots('noarchive, nocache'))).toEqual(['nocache']);

        expect(
            checks(robots('noarchive'), { header: 'bingbot: nocache' }),
        ).toEqual([
            {
                check: 'nocache',
                url,
                detail: { meta: ['noarchive'], header: ['nocache'] },
            },
        ]);
    });

    it('leaves noarchive scoped to Googlebot out of Bing’s directives', () => {
        expect(ids(robots('noarchive', 'googlebot'))).toEqual([]);
        expect(ids('', { header: 'googlebot: noarchive' })).toEqual([]);
    });

    it('reads the header of an answer that is not HTML', () => {
        expect(
            aiAccessChecks(
                url,
                {
                    headers: new Headers({
                        'x-robots-tag': 'nosnippet, noarchive',
                    }),
                } as Fetched,
                null,
                googlebotDirectives([], 'nosnippet, noarchive'),
                { aiSearchBlocked: () => [] },
            ).map((finding) => finding.check),
        ).toEqual(['nosnippet', 'noarchive']);
    });
});

import { describe, expect, it } from 'vitest';

import {
    checkMarkdown,
    hasMarkdownLink,
    isLlmsTxt,
    isMarkdownAnswer,
    judgeVary,
    markdownAccept,
    markdownTwins,
    type ReadPage,
} from '@/features/audit/markdown-checks';
import type { Fetched } from '@/features/crawl/fetch';

const home = 'https://acme.com/';
const llms = 'https://acme.com/llms.txt';
const html = { 'content-type': 'text/html; charset=utf-8' };

function answer(
    status: number,
    headers: Record<string, string> = {},
    body = '',
): Fetched {
    return {
        ok: status < 400,
        status,
        url: home,
        headers: new Headers(headers),
        body,
        bytes: 0,
        isUtf8: true,
        isTruncated: false,
        hops: [{ url: home, status }],
        headersMs: 0,
    };
}

function site(answers: Record<string, Fetched | Error | null>) {
    const asked: [string, string | undefined][] = [];

    const read: ReadPage = async (url, options) => {
        asked.push([url, options?.headers?.accept]);

        if (url in answers) {
            return answers[url];
        }

        return url === home ? answer(200, html, '<html></html>') : answer(404);
    };

    return { asked, read };
}

const allowed = () => false;

describe('checkMarkdown', () => {
    it('asks the home page for markdown first, and stops at a markdown answer whose Vary names Accept', async () => {
        const { asked, read } = site({
            [home]: answer(200, {
                'content-type': 'text/markdown; charset=utf-8',
                vary: 'Accept-Encoding, ACCEPT',
            }),
        });

        expect(await checkMarkdown(home, read, allowed)).toBeNull();
        expect(asked).toEqual([[home, markdownAccept]]);
    });

    it('gives the vary half for a markdown answer without Accept in Vary, with the Vary as served', async () => {
        const { read } = site({
            [home]: answer(200, {
                'content-type': 'text/markdown',
                vary: 'Accept-Encoding',
            }),
        });

        expect(await checkMarkdown(home, read, allowed)).toEqual({
            check: 'markdown-alternate',
            url: null,
            subject: home,
            detail: { reason: 'vary', vary: 'Accept-Encoding' },
        });
    });

    it('stops at an HTML home page that links its markdown in the Link header only', async () => {
        const { asked, read } = site({
            [home]: answer(200, {
                ...html,
                link: '</index.md>; rel="alternate"; type="text/markdown"',
            }),
        });

        expect(await checkMarkdown(home, read, allowed)).toBeNull();
        expect(asked).toHaveLength(1);
    });

    it('asks the two twins, then llms.txt, and stops at the first one found', async () => {
        const { asked, read } = site({
            [home]: answer(200, html, '<html></html>'),
            'https://acme.com/index.html.md': answer(200, {
                'content-type': 'text/markdown',
            }),
        });

        expect(await checkMarkdown(home, read, allowed)).toBeNull();

        expect(asked.map(([url]) => url)).toEqual([
            home,
            'https://acme.com/index.md',
            'https://acme.com/index.html.md',
        ]);
    });

    it('finds an llms.txt served as text/plain with a byte-order mark before its title', async () => {
        const { asked, read } = site({
            [llms]: answer(
                200,
                { 'content-type': 'text/plain; charset=utf-8' },
                '﻿# Acme\n\n> Boots.',
            ),
        });

        expect(await checkMarkdown(home, read, allowed)).toBeNull();
        expect(asked).toHaveLength(4);
    });

    it('gives the missing half when every way was asked and answered, a twin answering 200 HTML and llms.txt an HTML soft 404', async () => {
        const { asked, read } = site({
            [home]: answer(200, html, '<html><head></head></html>'),
            'https://acme.com/index.md': answer(200, html, '<html></html>'),
            [llms]: answer(200, html, '<!doctype html>\n<h1>Not found</h1>'),
        });

        expect(await checkMarkdown(home, read, allowed)).toEqual({
            check: 'markdown-alternate',
            url: null,
            subject: home,
            detail: { reason: 'missing' },
        });

        expect(asked.map(([url, accept]) => [url, accept])).toEqual([
            [home, markdownAccept],
            ['https://acme.com/index.md', undefined],
            ['https://acme.com/index.html.md', undefined],
            [llms, undefined],
        ]);
    });

    it('gives no finding when a request it still needed failed or had no time left', async () => {
        for (const failed of [new Error('reset'), null]) {
            for (const url of [home, 'https://acme.com/index.md', llms]) {
                const { asked, read } = site({ [url]: failed });

                expect(
                    await checkMarkdown(home, read, allowed),
                    url,
                ).toBeNull();

                expect(asked.at(-1)![0]).toBe(url);
            }
        }
    });

    it('concludes nothing from a home page that is not a 200, or a later way refused, rate-limited or failing, and asks no further', async () => {
        for (const status of [403, 404, 429, 503]) {
            const { asked, read } = site({ [home]: answer(status, html) });

            expect(await checkMarkdown(home, read, allowed)).toBeNull();
            expect(asked).toHaveLength(1);
        }

        for (const status of [401, 403, 429, 500]) {
            const { asked, read } = site({
                [home]: answer(200, html),
                'https://acme.com/index.md': answer(status, html),
            });

            expect(await checkMarkdown(home, read, allowed)).toBeNull();
            expect(asked).toHaveLength(2);
        }

        const gone = site({
            [home]: answer(200, html),
            'https://acme.com/index.md': answer(410),
        });

        expect((await checkMarkdown(home, gone.read, allowed))?.detail).toEqual(
            { reason: 'missing' },
        );
    });

    it('asks nothing when robots.txt blocks the home page, and concludes nothing when it blocks a way', async () => {
        const blocked = site({});

        expect(await checkMarkdown(home, blocked.read, () => true)).toBeNull();
        expect(blocked.asked).toEqual([]);

        const twinBlocked = site({});

        expect(
            await checkMarkdown(home, twinBlocked.read, (url) =>
                url.endsWith('.md'),
            ),
        ).toBeNull();

        expect(twinBlocked.asked.map(([url]) => url)).toEqual([home, llms]);

        const found = site({ [llms]: answer(200, {}, '# Acme') });

        expect(
            await checkMarkdown(home, found.read, (url) => url.endsWith('.md')),
        ).toBeNull();
    });
});

describe('isMarkdownAnswer', () => {
    it('is a 200 whose media type is text/markdown, in any case and with parameters', () => {
        expect(
            isMarkdownAnswer(
                answer(200, { 'content-type': 'text/markdown; charset=utf-8' }),
            ),
        ).toBe(true);

        expect(
            isMarkdownAnswer(answer(200, { 'content-type': 'Text/Markdown' })),
        ).toBe(true);

        expect(
            isMarkdownAnswer(answer(404, { 'content-type': 'text/markdown' })),
        ).toBe(false);

        expect(isMarkdownAnswer(answer(200, html))).toBe(false);
    });
});

describe('hasMarkdownLink', () => {
    it('reads a link tag whose rel holds alternate and whose type is markdown, in any case', () => {
        expect(
            hasMarkdownLink(
                answer(
                    200,
                    html,
                    '<head><link rel="Alternate Nofollow" type="TEXT/markdown" href="/index.md"></head>',
                ),
            ),
        ).toBe(true);
    });

    it('ignores a link of another type or relation, one without an address, and a tag in an answer that is not HTML', () => {
        for (const tag of [
            '<link rel="alternate" type="application/rss+xml" href="/feed">',
            '<link rel="describedby" type="text/markdown" href="/llms.txt">',
            '<link rel="alternate" type="text/markdown" href=" ">',
        ]) {
            expect(hasMarkdownLink(answer(200, html, tag)), tag).toBe(false);
        }

        expect(
            hasMarkdownLink(
                answer(
                    200,
                    { 'content-type': 'application/json' },
                    '<link rel="alternate" type="text/markdown" href="/a.md">',
                ),
            ),
        ).toBe(false);
    });

    it('reads the same relation from the Link header', () => {
        expect(
            hasMarkdownLink(
                answer(200, {
                    ...html,
                    link: '<https://acme.com/>; rel="canonical", </index.md>; rel=alternate; type=text/markdown',
                }),
            ),
        ).toBe(true);
    });
});

describe('judgeVary', () => {
    const markdown = (vary?: string) =>
        answer(200, {
            'content-type': 'text/markdown',
            ...(vary === undefined ? {} : { vary }),
        });

    it('accepts Accept among the values of Vary, in any case, and *', () => {
        expect(judgeVary(home, markdown('Accept-Encoding, Accept'))).toBeNull();
        expect(judgeVary(home, markdown('accept-encoding,ACCEPT'))).toBeNull();
        expect(judgeVary(home, markdown('*'))).toBeNull();
    });

    it('gives the vary half when Vary lacks Accept or is absent', () => {
        expect(judgeVary(home, markdown('Accept-Encoding'))?.detail).toEqual({
            reason: 'vary',
            vary: 'Accept-Encoding',
        });

        expect(judgeVary(home, markdown('Accept-Language'))?.detail).toEqual({
            reason: 'vary',
            vary: 'Accept-Language',
        });

        expect(judgeVary(home, markdown())?.detail).toEqual({
            reason: 'vary',
            vary: 'not sent',
        });
    });
});

describe('markdownTwins', () => {
    it('appends index.md and index.html.md to the path, after a slash when it has none', () => {
        expect(markdownTwins('https://acme.com/')).toEqual([
            'https://acme.com/index.md',
            'https://acme.com/index.html.md',
        ]);

        expect(markdownTwins('https://acme.com/de')).toEqual([
            'https://acme.com/de/index.md',
            'https://acme.com/de/index.html.md',
        ]);
    });

    it('adds no second slash to a locale base that ends with one', () => {
        expect(markdownTwins('https://acme.com/de/')).toEqual([
            'https://acme.com/de/index.md',
            'https://acme.com/de/index.html.md',
        ]);
    });

    it('drops the query of the home page, because a twin is a file path', () => {
        expect(markdownTwins('https://acme.com/?lang=de')).toEqual([
            'https://acme.com/index.md',
            'https://acme.com/index.html.md',
        ]);

        expect(markdownTwins('https://acme.com/de/?ref=nav')).toEqual([
            'https://acme.com/de/index.md',
            'https://acme.com/de/index.html.md',
        ]);
    });
});

describe('isLlmsTxt', () => {
    it('is a 200 whose first line is a markdown H1, after an optional byte-order mark, whatever its type', () => {
        expect(isLlmsTxt(answer(200, {}, '# Acme\n> Boots.'))).toBe(true);
        expect(isLlmsTxt(answer(200, {}, '﻿# Acme'))).toBe(true);
        expect(isLlmsTxt(answer(200, html, '# Acme\r\n'))).toBe(true);
    });

    it('is not a missing file, a page without an H1 first, an H2 or an empty title', () => {
        expect(isLlmsTxt(answer(404, {}, '# Acme'))).toBe(false);
        expect(isLlmsTxt(answer(200, {}, '\n# Acme'))).toBe(false);
        expect(isLlmsTxt(answer(200, {}, '## Acme'))).toBe(false);
        expect(isLlmsTxt(answer(200, {}, '#Acme'))).toBe(false);
        expect(isLlmsTxt(answer(200, {}, '# '))).toBe(false);
    });
});

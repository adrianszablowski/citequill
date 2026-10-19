import * as cheerio from 'cheerio';

import type { Finding } from '@/features/audit/finding';
import {
    type Fetched,
    type FetchOptions,
    isHtml,
} from '@/features/crawl/fetch';
import {
    headerMarkdownLink,
    isMarkdownType,
} from '@/features/crawl/markdown-source';

export type ReadPage = (
    url: string,
    options?: Pick<FetchOptions, 'headers'>,
) => Promise<Fetched | Error | null>;

export const markdownAccept = 'text/markdown, text/html;q=0.9, */*;q=0.8';

export async function checkMarkdown(
    home: string,
    read: ReadPage,
    isBlocked: (url: string) => boolean,
): Promise<Finding | null> {
    if (isBlocked(home)) {
        return null;
    }

    const page = await read(home, { headers: { accept: markdownAccept } });

    if (page === null || page instanceof Error || page.status !== 200) {
        return null;
    }

    if (isMarkdownAnswer(page)) {
        return judgeVary(home, page);
    }

    if (hasMarkdownLink(page)) {
        return null;
    }

    let isSkipped = false;

    for (const [url, offers] of laterWays(home)) {
        if (isBlocked(url)) {
            isSkipped = true;

            continue;
        }

        const fetched = await read(url);

        if (fetched === null || fetched instanceof Error) {
            return null;
        }

        if (offers(fetched) || !concludingStatuses.has(fetched.status)) {
            return null;
        }
    }

    return isSkipped ? null : markdownFinding(home, { reason: 'missing' });
}

export function isMarkdownAnswer({ status, headers }: Fetched) {
    return status === 200 && isMarkdownType(headers.get('content-type'));
}

export function hasMarkdownLink({ headers, body }: Fetched) {
    return (
        headerMarkdownLink(headers.get('link')) !== null ||
        (isHtml(headers) &&
            cheerio
                .load(body)('link[rel~="alternate" i][type][href]')
                .toArray()
                .some(
                    (element) =>
                        element.attribs.href.trim() !== '' &&
                        isMarkdownType(element.attribs.type),
                ))
    );
}

export function judgeVary(home: string, fetched: Fetched): Finding | null {
    const vary = fetched.headers.get('vary');

    const values = (vary ?? '')
        .split(',')
        .map((value) => value.trim().toLowerCase());

    return values.includes('accept') || values.includes('*')
        ? null
        : markdownFinding(home, { reason: 'vary', vary: vary ?? 'not sent' });
}

export function markdownTwins(home: string) {
    return ['index.md', 'index.html.md'].map((name) => {
        const url = new URL(home);

        url.pathname = `${url.pathname.replace(/\/?$/, '/')}${name}`;
        url.search = '';

        return url.href;
    });
}

export function isLlmsTxt({ status, body }: Fetched) {
    const firstLine = body.replace(/^﻿/, '').split(/\r?\n/, 1)[0];

    return status === 200 && /^# +\S/.test(firstLine);
}

// A refusal, a rate limit or a server error says nothing about markdown, and a
// site that refuses the audit would otherwise read as offering none.
const concludingStatuses = new Set([200, 404, 410]);

function laterWays(home: string): [string, (fetched: Fetched) => boolean][] {
    return [
        ...markdownTwins(home).map(
            (url): [string, (fetched: Fetched) => boolean] => [
                url,
                isMarkdownAnswer,
            ],
        ),
        [new URL('/llms.txt', home).href, isLlmsTxt],
    ];
}

function markdownFinding(
    home: string,
    detail: { reason: 'missing' } | { reason: 'vary'; vary: string },
): Finding {
    return { check: 'markdown-alternate', url: null, subject: home, detail };
}

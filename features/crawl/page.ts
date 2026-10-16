import {
    type FetchDeps,
    fetchPublic,
    fetchText,
    isHtml,
} from '@/features/crawl/fetch';
import { type Alternate, readPage } from '@/features/crawl/html';
import { markdownUrlFor, pageBodies } from '@/features/crawl/markdown-source';
import type { Signals } from '@/features/crawl/signals';

export interface FetchedPage {
    title: string | null;
    lang: string | null;
    alternates: Alternate[];
    author: string | null;
    links: string[];
    signals: Signals | null;
    body: string;
    readerBody: string | null;
    error: string | null;
}

export async function fetchPage(
    url: string,
    llmsLinks: string[],
    deps?: FetchDeps,
): Promise<FetchedPage> {
    try {
        const response = await fetchPublic(url, deps);

        if (!response.ok) {
            return { ...emptyPage, error: `HTTP ${response.status}` };
        }

        if (!isHtml(response.headers)) {
            return { ...emptyPage, error: 'Not an HTML page.' };
        }

        const page = readPage(response.body, response.url);
        const markdownUrl = markdownUrlFor(url, response.headers, llmsLinks);

        const alternate = markdownUrl
            ? await fetchText(markdownUrl, deps)
            : null;

        return {
            title: page.title || null,
            lang: page.lang,
            alternates: page.alternates,
            author: page.author,
            links: page.links,
            signals: page.signals,
            ...pageBodies(page.markdown, alternate),
            error: null,
        };
    } catch (error) {
        return {
            ...emptyPage,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

const emptyPage: FetchedPage = {
    title: null,
    lang: null,
    alternates: [],
    author: null,
    links: [],
    signals: null,
    body: '',
    readerBody: null,
    error: null,
};

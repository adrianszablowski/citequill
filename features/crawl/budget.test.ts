import { describe, expect, it } from 'vitest';

import {
    chunkText,
    pageChunks,
    pageText,
    readerHeading,
} from '@/features/crawl/budget';
import type { Signals } from '@/features/crawl/signals';

const signals: Signals = {
    description: 'Invoices in a minute.',
    siteName: 'Acme',
    ogTitle: null,
    ogDescription: null,
    canonical: null,
    jsonLd: [{ '@type': 'Organization', name: 'Acme' }],
    emails: ['hi@acme.com'],
    phones: [],
    socialLinks: ['https://x.com/acme'],
    logo: null,
    headerLogo: null,
    sameAs: [],
    footer: 'Acme Inc, Warsaw',
};

describe('pageText', () => {
    it('lists the URL, the title, the page data and the body', () => {
        expect(
            pageText({
                url: 'https://acme.com/',
                title: 'Acme',
                body: 'Hello.',
                readerBody: null,
                signals,
            }),
        ).toBe(
            [
                '## https://acme.com/',
                'Acme',
                'Page data:\n- Description: Invoices in a minute.\n- Site name: Acme\n- Emails: hi@acme.com\n- Social profiles: https://x.com/acme\n- Footer: Acme Inc, Warsaw\n- JSON-LD: [{"@type":"Organization","name":"Acme"}]',
                'Hello.',
            ].join('\n\n'),
        );
    });

    it('leaves out what the page does not have and cuts the body at the per-page cap', () => {
        expect(
            pageText(
                {
                    url: 'https://acme.com/b',
                    title: null,
                    body: 'x'.repeat(100),
                    readerBody: null,
                    signals: null,
                },
                10,
            ),
        ).toBe(`## https://acme.com/b\n\n${'x'.repeat(10)}`);
    });

    it('adds the text readers see after the body, under its heading and cut at its own cap', () => {
        expect(
            pageText(
                {
                    url: 'https://acme.com/',
                    title: null,
                    body: '- Feature list',
                    readerBody: 'You lift. Trackist does the math.',
                    signals: null,
                },
                100,
                9,
            ),
        ).toBe(
            `## https://acme.com/\n\n- Feature list\n\n${readerHeading}:\nYou lift.`,
        );
    });
});

const pages = Array.from({ length: 5 }, (_, i) => ({
    url: `https://acme.com/${i}`,
    title: 'T',
    body: 'y'.repeat(50),
    readerBody: null,
    signals: null,
}));

describe('pageChunks', () => {
    it('groups pages into chunks under the chunk cap', () => {
        const chunks = pageChunks(pages, 50, 160, 10_000);

        expect(chunks.map((chunk) => chunk.length)).toEqual([2, 2, 1]);
        expect(chunks[0][0]).toBe(pages[0]);
    });

    it('stops adding pages at the total cap', () => {
        expect(pageChunks(pages, 50, 10_000, 200)).toEqual([pages.slice(0, 2)]);
        expect(pageChunks([], 50, 160, 200)).toEqual([]);
    });
});

describe('chunkText', () => {
    it('joins the pages of a chunk with a rule between them', () => {
        expect(chunkText(pages.slice(0, 2), 3)).toBe(
            '## https://acme.com/0\n\nT\n\nyyy\n\n---\n\n## https://acme.com/1\n\nT\n\nyyy',
        );
    });
});

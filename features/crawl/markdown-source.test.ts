import { describe, expect, it } from 'vitest';

import {
    headerMarkdownLink,
    isMarkdownType,
    linksFromLlmsText,
    markdownUrlFor,
    pageBodies,
} from '@/features/crawl/markdown-source';

describe('pageBodies', () => {
    it('makes the markdown version the body and keeps the HTML text for readers', () => {
        expect(pageBodies('# You lift.', '- Feature list')).toEqual({
            body: '- Feature list',
            readerBody: '# You lift.',
        });
    });

    it('uses the HTML text as the body when there is no markdown version or it is empty', () => {
        expect(pageBodies('# You lift.', null)).toEqual({
            body: '# You lift.',
            readerBody: null,
        });

        expect(pageBodies('# You lift.', '')).toEqual({
            body: '# You lift.',
            readerBody: null,
        });
    });
});

describe('markdownUrlFor', () => {
    it('takes the markdown alternate from the Link header', () => {
        const headers = new Headers({
            link: '</docs/intro.md>; rel="alternate"; type="text/markdown", <https://acme.com/>; rel="canonical"',
        });

        expect(markdownUrlFor('https://acme.com/docs/intro', headers, [])).toBe(
            'https://acme.com/docs/intro.md',
        );
    });

    it('takes the page listed in llms.txt with a .md ending', () => {
        const links = [
            'https://acme.com/docs/intro.md',
            'https://acme.com/pricing/index.md',
        ];

        expect(
            markdownUrlFor('https://acme.com/docs/intro', new Headers(), links),
        ).toBe('https://acme.com/docs/intro.md');

        expect(
            markdownUrlFor('https://acme.com/pricing/', new Headers(), links),
        ).toBe('https://acme.com/pricing/index.md');
    });

    it('is null when nothing points to markdown', () => {
        expect(
            markdownUrlFor('https://acme.com/about', new Headers(), [
                'https://acme.com/docs/intro.md',
            ]),
        ).toBeNull();
    });
});

describe('headerMarkdownLink', () => {
    it('takes the alternate link whose type is markdown, the type in any case and with parameters', () => {
        expect(
            headerMarkdownLink(
                '</llms.txt>; rel="describedby", </index.md>; REL=Alternate; type="Text/Markdown; charset=utf-8"',
            ),
        ).toBe('/index.md');
    });

    it('is null without an alternate of type markdown', () => {
        expect(
            headerMarkdownLink(
                '</de>; rel="alternate"; hreflang="de", </index.md>; rel="describedby"; type="text/markdown"',
            ),
        ).toBeNull();

        expect(headerMarkdownLink(null)).toBeNull();
    });
});

describe('isMarkdownType', () => {
    it('compares the media type in any case, without its parameters', () => {
        expect(isMarkdownType('Text/Markdown; charset=utf-8')).toBe(true);
        expect(isMarkdownType(' text/markdown ')).toBe(true);
        expect(isMarkdownType('text/plain')).toBe(false);
        expect(isMarkdownType(null)).toBe(false);
    });
});

describe('linksFromLlmsText', () => {
    it('collects the markdown links as absolute URLs', () => {
        const text =
            '# Acme\n\n- [Intro](/docs/intro.md): the basics\n- [Pricing](https://acme.com/pricing.md)\n- [Broken](http://)';

        expect(linksFromLlmsText(text, 'https://acme.com/llms.txt')).toEqual([
            'https://acme.com/docs/intro.md',
            'https://acme.com/pricing.md',
        ]);
    });
});

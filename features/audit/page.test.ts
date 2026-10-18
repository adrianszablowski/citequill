import { describe, expect, it } from 'vitest';

import { readAuditPage } from '@/features/audit/page';

const html = `<!doctype html>
<html lang="en-GB">
<head>
<title>Pricing</title>
<meta name="Robots" content="noindex">
<meta name="googlebot" content="nosnippet">
<link rel="canonical" href="/pricing#top">
<link rel="alternate" hreflang="de" href="https://acme.de/preise">
</head>
<body>
<header><a href="/">Home</a></header>
<main><h1>Plans</h1><p>Two plans.</p><a href="/contact#form">Contact</a><a href="/contact">Again</a></main>
<a href="https://other.com/">Partner</a>
<a href="javascript:void(0)">Menu</a>
</body>
</html>`;

describe('readAuditPage', () => {
    it('reads the head, the alternates and every http link of a page', () => {
        const page = readAuditPage(html, 'https://acme.com/pricing');

        expect(page).toMatchObject({
            title: 'Pricing',
            lang: 'en-gb',
            canonical: 'https://acme.com/pricing',
            robotsMeta: ['noindex', 'nosnippet'],
            alternates: [{ lang: 'de', href: 'https://acme.de/preise' }],
            links: [
                'https://acme.com/',
                'https://acme.com/contact',
                'https://other.com/',
            ],
        });
    });

    it('hashes the main text, so two pages with the same content share a hash whatever their chrome', () => {
        const one = readAuditPage(html, 'https://acme.com/pricing');

        const other = readAuditPage(
            html.replace(
                '<header><a href="/">Home</a></header>',
                '<nav>Other</nav>',
            ),
            'https://acme.com/pricing-copy',
        );

        const changed = readAuditPage(
            html.replace('Two plans.', 'Three plans.'),
            'https://acme.com/pricing',
        );

        expect(one.bodyHash).toMatch(/^[0-9a-f]{64}$/);
        expect(other.bodyHash).toBe(one.bodyHash);
        expect(changed.bodyHash).not.toBe(one.bodyHash);
    });

    it('has no hash and no words for a page with no text', () => {
        const page = readAuditPage(
            '<html><body><div id="root"></div></body></html>',
            'https://acme.com/',
        );

        expect(page.bodyHash).toBeNull();
        expect(page.wordCount).toBe(0);
    });

    it('keeps every canonical tag as written, where it sits and what it looks like', () => {
        const page = readAuditPage(
            `<html><head><link rel="canonical" href="/a"></head><body><p>Text</p><link rel="canonical" class="seo" href="https://acme.com/b"></body></html>`,
            'https://acme.com/a',
        );

        expect(page.canonical).toBe('https://acme.com/a');

        expect(page.canonicals).toEqual([
            {
                href: '/a',
                isInHead: true,
                selector: 'link',
                snippet: '<link rel="canonical" href="/a">',
            },
            {
                href: 'https://acme.com/b',
                isInHead: false,
                selector: 'link.seo',
                snippet:
                    '<link rel="canonical" class="seo" href="https://acme.com/b">',
            },
        ]);
    });

    it('reads a meta refresh and counts the words of the main text', () => {
        const page = readAuditPage(
            '<html><head><meta http-equiv="Refresh" content="0; url=/new"></head><body><nav>Menu items here</nav><main>One two  three\nfour</main></body></html>',
            'https://acme.com/old',
        );

        expect(page.refresh).toBe('0; url=/new');
        expect(page.wordCount).toBe(4);

        expect(
            readAuditPage(html, 'https://acme.com/pricing').refresh,
        ).toBeNull();
    });

    it('reads the titles, descriptions and Open Graph tags of the document, never an inline svg title, and names matched in any case', () => {
        const page = readAuditPage(
            `<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title> Pricing </title><meta name="Description" content=" Two plans. "><meta property="OG:Title" content="Pricing"><meta name="og:image" content="/a.png"><meta property="og:url" content=""><meta property="article:modified_time" content="2026-01-01"></head><body><svg role="img"><title>Logo</title></svg><main><p>Text</p></main></body></html>`,
            'https://acme.com/pricing',
        );

        expect(page).toMatchObject({
            title: 'Pricing',
            titles: [
                {
                    text: 'Pricing',
                    isInHead: true,
                    selector: 'title',
                    snippet: '<title> Pricing </title>',
                },
            ],
            descriptions: [{ content: 'Two plans.', isInHead: true }],
            hasDoctype: true,
            hasMetaCharset: true,
            openGraph: ['og:title', 'og:image'],
            modifiedTime: '2026-01-01',
            misplaced: [],
        });
    });

    it('has no doctype, charset, title or description on a bare fragment', () => {
        expect(readAuditPage('<p>Hi</p>', 'https://acme.com/')).toMatchObject({
            title: null,
            titles: [],
            descriptions: [],
            hasDoctype: false,
            hasMetaCharset: false,
            openGraph: [],
            modifiedTime: null,
            images: [],
        });
    });

    it('reads the H1s and every heading level in document order', () => {
        const page = readAuditPage(
            '<html><body><header><h2>Menu</h2></header><h1> Plans  for teams </h1><h3 id="faq">FAQ</h3><h1>Again</h1></body></html>',
            'https://acme.com/',
        );

        expect(page.h1s).toEqual(['Plans for teams', 'Again']);

        expect(
            page.headings.map(({ level, selector }) => [level, selector]),
        ).toEqual([
            [2, 'h2'],
            [1, 'h1'],
            [3, 'h3#faq'],
            [1, 'h1'],
        ]);
    });

    it('reads an H1 that holds only an image by the alt of the image', () => {
        const page = readAuditPage(
            '<html><body><h1><a href="/"><img src="/logo.svg" alt=" Acme "></a></h1><h1><img src="/x.png" alt=""></h1></body></html>',
            'https://acme.com/',
        );

        expect(page.h1s).toEqual(['Acme', '']);
    });

    it('finds the head elements the parser moved into the body after an element the head does not allow, and not the ones written in the body', () => {
        const page = readAuditPage(
            '<html><head><title>A</title><img src="/pixel.gif"><meta name="description" content="Late"><link rel="canonical" href="https://acme.com/"></head><body><style>.a{}</style><meta itemprop="price" content="9"></body></html>',
            'https://acme.com/',
        );

        expect(page.misplaced).toEqual([
            {
                selector: 'meta',
                snippet: '<meta name="description" content="Late">',
            },
            {
                selector: 'link',
                snippet: '<link rel="canonical" href="https://acme.com/">',
            },
        ]);

        expect(page.descriptions).toEqual([
            { content: 'Late', isInHead: false },
        ]);

        expect(
            readAuditPage(
                '<title>A</title><div>x</div><meta name="description" content="Late">',
                'https://acme.com/',
            ).misplaced,
        ).toEqual([]);
    });

    it('reads frames, applets and plugin objects, and the visible text without scripts, styles, templates or noscript', () => {
        const page = readAuditPage(
            '<html><body><p>Lorem  ipsum</p><script>var a = 1;</script><style>p{}</style><noscript><img src="/x.gif"></noscript><template><p>Row</p></template><object type="application/x-shockwave-flash" data="/a"></object><iframe src="/b"></iframe><embed src="/movie.mp4"></body></html>',
            'https://acme.com/',
        );

        expect(page.visibleText).toBe('Lorem ipsum');

        expect(page.markupLength).toBe(
            '<html><body><p>Lorem  ipsum</p><noscript><img src="/x.gif"></noscript><template><p>Row</p></template><object type="application/x-shockwave-flash" data="/a"></object><iframe src="/b"></iframe><embed src="/movie.mp4"></body></html>'
                .length,
        );

        expect(page.plugins).toEqual([
            {
                name: 'object',
                selector: 'object',
                snippet:
                    '<object type="application/x-shockwave-flash" data="/a"></object>',
            },
        ]);
    });

    it('reads the images before the main text is cut out, so a logo in the header is listed', () => {
        const page = readAuditPage(
            '<html><body><header><img src="/logo.png" alt="Acme"><svg role="img"><title>Menu</title></svg></header><main><p>Text</p></main></body></html>',
            'https://acme.com/',
        );

        expect(page.images.map(({ tag, src }) => src ?? tag)).toEqual([
            'https://acme.com/logo.png',
            'svg',
        ]);

        expect(page.wordCount).toBe(1);
    });

    it('reads the stylesheets and scripts of the document once each, as absolute URLs', () => {
        const page = readAuditPage(
            '<html><head><link rel="Stylesheet" href="/a.css"><link rel="preload stylesheet" href="https://cdn.com/b.css"><link rel="icon" href="/icon.png"><script src="/app.js"></script><script>inline()</script></head><body><script src="/app.js"></script></body></html>',
            'https://acme.com/',
        );

        expect(page.assets).toEqual([
            'https://acme.com/a.css',
            'https://cdn.com/b.css',
            'https://acme.com/app.js',
        ]);
    });

    it('keeps the raw links whose fragment is a page number', () => {
        const page = readAuditPage(
            '<html><body><a href="#page=2">2</a><a href="/blog#strona=3">3</a><a href="/blog#page-2">x</a><a href="/blog?page=2">y</a></body></html>',
            'https://acme.com/blog',
        );

        expect(page.fragmentLinks).toEqual(['#page=2', '/blog#strona=3']);
    });

    it('reads the outermost blocks off screen or at zero size or opacity, of 50 words or more with no link, button or form control inside, and no block with display:none', () => {
        const words = (count: number) =>
            Array.from({ length: count }, (_, i) => `word${i}`).join(' ');

        const page = readAuditPage(
            `<html><body><main><p>Text</p>
            <div id="seo" style="position:absolute; left:-9999px"><p style="font-size:0">${words(30)}</p> ${words(20)}</div>
            <div class="off" style="text-indent:-9999px">${words(60)}</div>
            <div style="display:none">${words(60)}</div>
            <div style="display:none"><p class="faded" style="opacity:0">${words(60)}</p></div>
            <div style="font-size:0">${words(49)}</div>
            <nav style="text-indent:-9999px">${words(60)}<a href="/">Home</a></nav>
            <div style="opacity:0">${words(60)}<button>Accept</button></div>
            <div style="left:-9999px">${words(40)}<script>${words(20)}</script></div>
            </main></body></html>`,
            'https://acme.com/',
        );

        expect(
            page.hiddenBlocks.map(({ selector, words }) => [selector, words]),
        ).toEqual([
            ['div#seo', 50],
            ['div.off', 60],
            ['p.faded', 60],
        ]);

        expect(page.hiddenBlocks[0].text).toBe(`${words(30)} ${words(20)}`);
        expect(page.hiddenBlocks[0].snippet).toMatch(/^<div id="seo"/);
    });

    it('takes a SimHash of the main text the body hash is taken from, and none of an empty page', () => {
        const one = readAuditPage(html, 'https://acme.com/pricing');

        const other = readAuditPage(
            html.replace('<header><a href="/">Home</a></header>', ''),
            'https://acme.com/pricing-copy',
        );

        expect(one.simhash).toMatch(/^[0-9a-f]{16}$/);
        expect(other.simhash).toBe(one.simhash);

        expect(
            readAuditPage('<html><body></body></html>', 'https://acme.com/')
                .simhash,
        ).toBeNull();
    });
});

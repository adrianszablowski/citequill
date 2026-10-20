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

describe('readAuditPage, for snippets', () => {
    const article = 'An article long enough to be the main text. '.repeat(10);
    const sidebar = 'A short note.';

    const nosnippet = (body: string) =>
        readAuditPage(`<html><body>${body}</body></html>`, 'https://acme.com/a')
            .nosnippet;

    it('keeps the robots and bingbot meta tags apart from the robots and googlebot ones', () => {
        const page = readAuditPage(
            '<html><head><meta name="robots" content="max-snippet:-1"><meta name="googlebot" content="nosnippet"><meta name="BingBot" content="noarchive"></head></html>',
            'https://acme.com/a',
        );

        expect(page.robotsMeta).toEqual(['max-snippet:-1', 'nosnippet']);
        expect(page.bingbotMeta).toEqual(['max-snippet:-1', 'noarchive']);
    });

    it('has no data-nosnippet element when no span, div or section is the main element or around it', () => {
        expect(nosnippet(`<main><p>${article}</p></main>`)).toBeNull();

        expect(
            nosnippet(`<main data-nosnippet><p>${article}</p></main>`),
        ).toBeNull();

        expect(
            nosnippet(`<main><p data-nosnippet>${article}</p></main>`),
        ).toBeNull();

        expect(
            nosnippet(
                `<main><div class="entry" data-nosnippet><p>${article}</p></div><p>${sidebar}</p></main>`,
            ),
        ).toBeNull();

        expect(
            readAuditPage(
                `<html><body data-nosnippet><main><p>${article}</p></main></body></html>`,
                'https://acme.com/a',
            ).nosnippet,
        ).toBeNull();
    });

    it('names the outermost data-nosnippet element that is the main element or sits around it', () => {
        expect(
            nosnippet(
                `<div class="wrap" data-nosnippet><div class="inner" data-nosnippet><main>${article}</main></div></div>`,
            ),
        ).toBe('div.wrap');

        expect(
            nosnippet(`<div role="main" data-nosnippet>${article}</div>`),
        ).toBe('div');
    });

    it('leaves out a data-nosnippet in a sidebar the main text does not hold', () => {
        expect(
            nosnippet(
                `<main>${article}</main><aside><div data-nosnippet>${article}</div></aside>`,
            ),
        ).toBeNull();
    });
});

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
                hasHreflang: false,
                selector: 'link',
                snippet: '<link rel="canonical" href="/a">',
            },
            {
                href: 'https://acme.com/b',
                isInHead: false,
                hasHreflang: false,
                selector: 'link.seo',
                snippet:
                    '<link rel="canonical" class="seo" href="https://acme.com/b">',
            },
        ]);
    });

    it('tells a canonical tag that carries an hreflang attribute, even an empty one', () => {
        const page = readAuditPage(
            '<html><head><link rel="canonical" hreflang="en" href="/a"><link rel="canonical" hreflang href="/b"></head></html>',
            'https://acme.com/a',
        );

        expect(page.canonicals.map(({ hasHreflang }) => hasHreflang)).toEqual([
            true,
            true,
        ]);
    });

    it('keeps every hreflang tag as written in document order, with its absolute URL, skips an alternative stylesheet and a tag without href, and derives the alternates from the ones that resolve', () => {
        const page = readAuditPage(
            `<html><head>
<link rel="alternate" hreflang=" en-GB " href=" https://acme.com/uk ">
<link rel="Alternate Stylesheet" hreflang="de" href="/de">
<link rel="alternate" hreflang="EN-gb" href="https://acme.com/uk#top">
<link rel="alternate" hreflang="fr" href="javascript:void(0)">
<link rel="alternate" href="https://acme.com/feed">
<link rel="alternate" type="application/rss+xml" hreflang="pl">
</head><body><svg><link rel="alternate" hreflang="it" href="/it"></svg></body></html>`,
            'https://acme.com/a',
        );

        expect(page.alternateTags).toEqual([
            {
                lang: 'en-GB',
                href: 'https://acme.com/uk',
                url: 'https://acme.com/uk',
                selector: 'link',
                snippet:
                    '<link rel="alternate" hreflang=" en-GB " href=" https://acme.com/uk ">',
            },
            expect.objectContaining({
                lang: 'EN-gb',
                url: 'https://acme.com/uk',
            }),
            expect.objectContaining({
                lang: 'fr',
                href: 'javascript:void(0)',
                url: null,
            }),
        ]);

        expect(page.alternates).toEqual([
            { lang: 'en-gb', href: 'https://acme.com/uk' },
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
            page.headings.map(({ level, selector, text }) => [
                level,
                selector,
                text,
            ]),
        ).toEqual([
            [2, 'h2', 'Menu'],
            [1, 'h1', 'Plans for teams'],
            [3, 'h3#faq', 'FAQ'],
            [1, 'h1', 'Again'],
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

    it('puts a space between the texts of two elements in the visible text, so minified HTML keeps its numbers apart', () => {
        expect(
            readAuditPage(
                '<html><body><h1>Air Max 90</h1><p>149 zł</p></body></html>',
                'https://acme.com/',
            ).visibleText,
        ).toBe('Air Max 90 149 zł');
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

    it('reads every resource attribute with its kind and its absolute URL, srcset candidates one by one', () => {
        const page = readAuditPage(
            `<html><head><script src=" //cdn.com/a.js "></script><link rel="stylesheet" href="http://acme.com/b.css"></head><body>
<iframe src="https://maps.com/x"></iframe>
<picture><source srcset="/a.webp 1x, http://acme.com/a2.webp 2x"><img src="/a.png" srcset="/a-400.png 400w,/a-800.png 800w" alt=""></picture>
<video src="/v.mp4" poster="//cdn.com/p.jpg"><source src="/v.webm"></video><audio src="/s.mp3"></audio>
<svg><script src="/in-svg.js"></script></svg></body></html>`,
            'https://acme.com/',
        );

        expect(page.resources.map(({ kind, url }) => [kind, url])).toEqual([
            ['script', 'https://cdn.com/a.js'],
            ['stylesheet', 'http://acme.com/b.css'],
            ['iframe', 'https://maps.com/x'],
            ['image', 'https://acme.com/a.webp'],
            ['image', 'http://acme.com/a2.webp'],
            ['image', 'https://acme.com/a.png'],
            ['image', 'https://acme.com/a-400.png'],
            ['image', 'https://acme.com/a-800.png'],
            ['media', 'https://acme.com/v.mp4'],
            ['image', 'https://cdn.com/p.jpg'],
            ['media', 'https://acme.com/v.webm'],
            ['media', 'https://acme.com/s.mp3'],
        ]);

        expect(page.resources[0]).toMatchObject({
            selector: 'script',
            snippet: '<script src=" //cdn.com/a.js "></script>',
        });
    });

    it('reads every form with its absolute action and whether it asks for a password, and a password field outside any form', () => {
        const page = readAuditPage(
            '<html><body><form class="login" action="http://acme.com/login"><input type="Password"></form><form id="search"><input name="q"></form><input type="password"></body></html>',
            'https://acme.com/',
        );

        expect(
            page.forms.map(({ selector, action, hasPassword }) => [
                selector,
                action,
                hasPassword,
            ]),
        ).toEqual([
            ['form.login', 'http://acme.com/login', true],
            ['form#search', null, false],
        ]);

        expect(page.hasLonePassword).toBe(true);

        expect(
            readAuditPage(
                '<html><body><form><input type="password"></form></body></html>',
                'https://acme.com/',
            ).hasLonePassword,
        ).toBe(false);
    });

    it('reads the content of the first viewport meta in any case, or null when there is none', () => {
        expect(
            readAuditPage(
                '<html><head><meta name="Viewport" content=" width=device-width "><meta name="viewport" content="width=600"></head></html>',
                'https://acme.com/',
            ).viewport,
        ).toBe('width=device-width');

        expect(
            readAuditPage(
                '<html><head><meta name="viewport"></head></html>',
                'https://acme.com/',
            ).viewport,
        ).toBe('');

        expect(
            readAuditPage(
                '<html><head><meta name="description" content="width=1"></head></html>',
                'https://acme.com/',
            ).viewport,
        ).toBeNull();
    });

    it('keeps every JSON-LD block with its element, parsed or with its error, the og:site_name and whether the page holds microdata or RDFa', () => {
        const page = readAuditPage(
            `<html><head><meta property="og:site_name" content=" Acme &amp; Co "><script type="application/ld+json" class="yoast-schema-graph">{"@context":"https://schema.org","@type":"Thing"}</script></head><body><script type="application/ld+json">{oops}</script><p vocab="https://schema.org/">Text</p></body></html>`,
            'https://acme.com/',
        );

        expect(page.jsonLd).toEqual([
            {
                selector: 'script.yoast-schema-graph',
                snippet:
                    '<script type="application/ld+json" class="yoast-schema-graph">{"@context":"https://schema.org","@type":"Thing"}</script>',
                value: { '@context': 'https://schema.org', '@type': 'Thing' },
                error: null,
            },
            {
                selector: 'script',
                snippet: '<script type="application/ld+json">{oops}</script>',
                value: null,
                error: expect.any(String),
            },
        ]);

        expect(page.siteName).toBe('Acme & Co');
        expect(page.hasMicrodata).toBe(true);

        expect(readAuditPage('<p>Text</p>', 'https://acme.com/')).toMatchObject(
            { jsonLd: [], siteName: null, hasMicrodata: false },
        );
    });

    it('keeps the raw links whose fragment is a page number', () => {
        const page = readAuditPage(
            '<html><body><a href="#page=2">2</a><a href="/blog#strona=3">3</a><a href="/blog#page-2">x</a><a href="/blog?page=2">y</a></body></html>',
            'https://acme.com/blog',
        );

        expect(page.fragmentLinks).toEqual(['#page=2', '/blog#strona=3']);
    });

    it('reads every anchor of the document outside an inline svg, with its raw href, its text and its name', () => {
        const page = readAuditPage(
            '<html><body><a href=" /plans#top " class="cta" rel="NoFollow  noopener" target="_blank">  Our\n plans </a><a><img src="/a.png" alt=" Team "></a><a href="mailto:hi@acme.com" title="Mail"></a><svg><a href="/inside">x</a></svg></body></html>',
            'https://acme.com/',
        );

        expect(page.anchors).toMatchObject([
            {
                selector: 'a.cta',
                href: ' /plans#top ',
                url: 'https://acme.com/plans',
                text: 'Our plans',
                name: '',
                hasImage: false,
                rel: ['nofollow', 'noopener'],
            },
            {
                selector: 'a',
                href: null,
                url: null,
                text: '',
                name: 'Team',
                hasImage: true,
                rel: [],
            },
            {
                selector: 'a',
                href: 'mailto:hi@acme.com',
                url: null,
                text: '',
                name: 'Mail',
                hasImage: false,
                rel: [],
            },
        ]);

        expect(page.links).toEqual(['https://acme.com/plans']);
    });

    it('reads the og:image URLs and the og:url as absolute URLs', () => {
        const page = readAuditPage(
            '<html><head><meta property="og:image" content="/a.png"><meta property="og:image" content="https://cdn.acme.com/b.png"><meta property="og:image" content="/a.png"><meta property="og:url" content="/pricing#x"></head></html>',
            'https://acme.com/pricing',
        );

        expect(page.ogImages).toEqual([
            'https://acme.com/a.png',
            'https://cdn.acme.com/b.png',
        ]);

        expect(page.ogUrl).toBe('https://acme.com/pricing');
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

    it('counts the elements inside the document, an inline SVG as one element whatever it draws', () => {
        expect(
            readAuditPage(
                '<html><head><title>A</title></head><body><p>Text</p><svg><g><path d="M0 0"/><circle r="1"/></g></svg></body></html>',
                'https://acme.com/',
            ).elementCount,
        ).toBe(5);
    });
});

describe('readAuditPage, for the shape of a page', () => {
    const blogPosting =
        '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting"}</script>';

    const read = (head: string, body: string) =>
        readAuditPage(
            `<html><head>${head}</head><body>${body}</body></html>`,
            'https://acme.com/blog/post',
        );

    it('reads an article page from og:type article in any case, and from an Article node', () => {
        expect(
            read('<meta property="og:type" content=" ARTICLE ">', '').isArticle,
        ).toBe(true);

        expect(
            read('<meta property="og:type" content="article">', '').isArticle,
        ).toBe(true);

        expect(
            read('<meta property="og:type" content="website">', '').isArticle,
        ).toBe(false);

        expect(
            read(
                `<meta property="og:type" content="website">${blogPosting}`,
                '',
            ).isArticle,
        ).toBe(true);
    });

    it('reads og:type article only on a page with no JSON-LD block, parsed or not, a blank block aside', () => {
        const ogArticle = '<meta property="og:type" content="article">';

        expect(
            read(
                `${ogArticle}<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script>`,
                '',
            ).isArticle,
        ).toBe(false);

        expect(
            read(
                `${ogArticle}<script type="application/ld+json">{"@type":</script>`,
                '',
            ).isArticle,
        ).toBe(false);

        expect(
            read(
                `${ogArticle}<script type="application/ld+json">  </script>`,
                '',
            ).isArticle,
        ).toBe(true);
    });

    it('counts the words of the main content by its text nodes, and places the first H1 of the document against them', () => {
        const { mainContent } = read(
            '',
            '<nav>Home Blog</nav><article><header><h1>Hello world</h1></header><p>one two<b>three</b></p><h2>Why?</h2><p>four five six</p></article>',
        );

        expect(mainContent).toEqual({
            isLandmark: true,
            words: 7,
            h1: { wordsBefore: 0, wordsThrough: 0 },
            paragraphs: [
                { words: 3, wordsBefore: 0 },
                { words: 3, wordsBefore: 4 },
            ],
            headings: [{ level: 2, text: 'Why?', isAnswered: true }],
            bold: [{ text: 'three', isAnswered: false }],
            terms: [],
        });
    });

    it('places words by their offset in the source, where the parser moves a paragraph that stands loose in a table before it', () => {
        const words = (count: number) =>
            Array.from({ length: count }, () => 'word').join(' ');

        const { mainContent } = read(
            '',
            `<main><h1>Title</h1><table><tr><td>${words(150)}</td></tr><p>${words(25)}</p></table></main>`,
        );

        expect(mainContent.h1).toEqual({ wordsBefore: 0, wordsThrough: 1 });

        expect(mainContent.paragraphs).toEqual([
            { words: 25, wordsBefore: 151 },
        ]);
    });

    it('places an H1 inside the main content after the words before it, its own words through it', () => {
        const { mainContent } = read(
            '',
            '<main><p>a b c</p><h1>The title</h1><p>d</p></main>',
        );

        expect(mainContent.h1).toEqual({ wordsBefore: 3, wordsThrough: 5 });
        expect(mainContent.paragraphs[1]).toEqual({ words: 1, wordsBefore: 5 });
    });

    it('tells a main, role=main or article element from the body the main content falls back to', () => {
        expect(
            read('', '<div role="main"><p>a</p></div>').mainContent.isLandmark,
        ).toBe(true);

        expect(read('', '<div><p>a</p></div>').mainContent.isLandmark).toBe(
            false,
        );

        expect(read('', '<div><p>a</p></div>').mainContent.h1).toBeNull();
    });

    it('answers a strong or b with a paragraph before the next heading, and skips a strong between a heading and its paragraph', () => {
        const { mainContent } = read(
            '',
            '<main><p><strong>Why?</strong></p><p>Yes.</p><b>Who?</b><h2>Where?</h2><strong>Note</strong><p>Here.</p></main><footer><b>When?</b><p>Now.</p></footer>',
        );

        expect(mainContent.bold).toEqual([
            { text: 'Why?', isAnswered: true },
            { text: 'Who?', isAnswered: false },
            { text: 'Note', isAnswered: true },
        ]);

        expect(mainContent.headings).toEqual([
            { level: 2, text: 'Where?', isAnswered: true },
        ]);
    });

    it('answers a heading with a paragraph of text before the next heading, and reads summary and dt of the main content', () => {
        const { mainContent } = read(
            '',
            '<main><h2>One?</h2><p> </p><h3>Two?</h3><p>Yes.</p><h2>Three?</h2><details><summary> Why? </summary></details><dl><dt>Who?</dt></dl></main><footer><dl><dt>Where?</dt></dl></footer>',
        );

        expect(mainContent.headings).toEqual([
            { level: 2, text: 'One?', isAnswered: false },
            { level: 3, text: 'Two?', isAnswered: true },
            { level: 2, text: 'Three?', isAnswered: false },
        ]);

        expect(mainContent.terms).toEqual(['Why?', 'Who?']);
    });
});

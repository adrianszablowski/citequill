import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import { imagesOf } from '@/features/audit/images';

const base = new URL('https://acme.com/blog/post');

function images(body: string) {
    return imagesOf(cheerio.load(`<html><body>${body}</body></html>`), base);
}

function sources(body: string) {
    return images(body).map(({ tag, src }) => src ?? tag);
}

describe('imagesOf', () => {
    it('lists every img, inline svg and role="img" element in document order', () => {
        expect(
            sources(
                '<header><img src="/logo.png" alt="Acme"></header><svg><svg></svg></svg><main><span role="img" aria-label="Star">★</span><img src="cat.jpg"></main>',
            ),
        ).toEqual([
            'https://acme.com/logo.png',
            'svg',
            'span',
            'https://acme.com/blog/cat.jpg',
        ]);
    });

    it('lists nothing on a page with no images', () => {
        expect(images('<p>Text</p>')).toEqual([]);
    });

    it('skips an image hidden by aria-hidden or an inline style, on it or an ancestor', () => {
        expect(
            sources(
                [
                    '<img src="/a.png" aria-hidden="TRUE">',
                    '<div aria-hidden="true"><img src="/b.png"></div>',
                    '<img src="/c.png" style="display: none">',
                    '<div style="Visibility:Hidden"><svg></svg></div>',
                    '<div aria-hidden="false"><img src="/d.png"></div>',
                ].join(''),
            ),
        ).toEqual(['https://acme.com/d.png']);
    });

    it('lists no image inside noscript, which the parser reads as text, or inside template, whose content is a fragment', () => {
        expect(
            sources(
                '<noscript><img src="/pixel.gif"></noscript><template><img src="/row.png"></template><img src="/kept.png">',
            ),
        ).toEqual(['https://acme.com/kept.png']);
    });

    it('skips a tracking pixel, an empty alt with 0 or 1 pixel dimensions, and keeps a 1 pixel image that has an alt', () => {
        expect(
            sources(
                '<img src="/t.gif" alt="" width="1" height="1"><img src="/z.gif" alt="" width="0" height="0"><img src="/o.gif" alt="Dot" width="1" height="1"><img src="/w.gif" alt="" width="1">',
            ),
        ).toEqual(['https://acme.com/o.gif', 'https://acme.com/w.gif']);
    });

    it('reads what the verdicts need: the alt as written, the role, the name, the ancestor and the size', () => {
        const [linked, figured, plain] = images(
            '<a href="/"><img src="/logo.png" alt=" Acme " role="Presentation" tabindex="0"> Acme </a><figure><img src="/cat.jpg" title=" A cat " width="400" style="aspect-ratio: 4 / 3"><figcaption>Cat</figcaption></figure><img aria-labelledby="caption" class="hero wide">',
        );

        expect(linked).toMatchObject({
            alt: ' Acme ',
            role: 'presentation',
            isDecorative: true,
            hasTabindex: true,
            ancestor: 'link',
            linkText: 'acme',
        });

        expect(figured).toMatchObject({
            alt: null,
            title: 'A cat',
            ancestor: 'figure',
            linkText: null,
            width: '400',
            height: null,
            hasAspectRatio: true,
        });

        expect(plain).toMatchObject({
            src: null,
            hasSrc: false,
            isNamed: true,
            isDecorative: false,
            ancestor: null,
            selector: 'img.hero.wide',
            snippet: '<img aria-labelledby="caption" class="hero wide">',
        });
    });

    it('marks a figure image only when it is the sole element beside a figcaption', () => {
        const ancestors = (body: string) =>
            images(body).map(({ ancestor }) => ancestor);

        expect(
            ancestors(
                '<figure><img src="/a.png"></figure><figure><img src="/b.png"><img src="/c.png"><figcaption>Two</figcaption></figure>',
            ),
        ).toEqual([null, null, null]);
    });

    it('keeps the opening tag of an svg as its snippet, never its content, and finds its title', () => {
        const [named, bare] = images(
            '<svg role="img" viewBox="0 0 10 10"><title>Logo</title><path d="M0 0"></path></svg><svg><desc>x</desc><title>Late</title></svg>',
        );

        expect(named).toMatchObject({
            tag: 'svg',
            src: null,
            role: 'img',
            hasSvgTitle: true,
            snippet: '<svg role="img" viewBox="0 0 10 10">',
        });

        expect(bare).toMatchObject({ role: null, hasSvgTitle: false });
    });

    it('gives an inline svg or role="img" element the href of its use child, else a hash of its opening tag and text', () => {
        const subjects = (body: string) =>
            images(body).map(({ subject }) => subject);

        const [home, legacy, star, heart] = subjects(
            '<svg><use href="#icon-home"></use></svg><svg><use xlink:href="#icon-old"></use></svg><span role="img" class="icon">★</span><span role="img" class="icon">♥</span>',
        );

        expect([home, legacy]).toEqual(['#icon-home', '#icon-old']);
        expect(star).toMatch(/^[0-9a-f]{16}$/);
        expect(heart).toMatch(/^[0-9a-f]{16}$/);
        expect(star).not.toBe(heart);

        const logo =
            '<svg class="logo" viewBox="0 0 10 10"><title>Acme</title></svg>';

        expect(subjects(logo)).toEqual(subjects(`<p>Other page</p>${logo}`));

        expect(subjects('<img src="cat.jpg">')).toEqual([
            'https://acme.com/blog/cat.jpg',
        ]);
    });

    it('tells an img inside a picture, and an editor’s marker for a missing alt', () => {
        const [inPicture] = images(
            '<picture><source srcset="/a.webp"><img alt="A" generator-unable-to-provide-required-alt=""></picture>',
        );

        expect(inPicture).toMatchObject({
            isInPicture: true,
            hasSrc: false,
            hasGeneratorMarker: true,
        });
    });
});

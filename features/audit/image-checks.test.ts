import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import { snippetLength } from '@/features/audit/finding';
import { altMaxLength, imageChecks } from '@/features/audit/image-checks';
import { imagesOf } from '@/features/audit/images';

const url = 'https://acme.com/blog/post';

function check(body: string) {
    return imageChecks(
        url,
        imagesOf(
            cheerio.load(`<html><body>${body}</body></html>`),
            new URL(url),
        ),
    );
}

function checks(body: string) {
    return check(body).map((finding) => finding.check);
}

const sized = 'width="400" height="300"';

describe('imageChecks', () => {
    it('finds nothing on an image with a good alt and its size, or on a decorative one', () => {
        expect(
            checks(
                `<img src="/cat.jpg" alt="A cat asleep on a sofa" ${sized}><img src="/line.png" alt="" ${sized}><img src="/dot.png" role="none" ${sized}>`,
            ),
        ).toEqual([]);
    });

    it('finds nothing on a page with no images', () => {
        expect(check('<p>Text</p>')).toEqual([]);
    });

    it('reports an image with no alt, one finding per image, with what the images card shows', () => {
        expect(check('<img src="/a.png" class="hero" width="10">')).toEqual([
            {
                check: 'img-no-dimensions',
                url,
                subject: 'https://acme.com/a.png',
                selector: 'img.hero',
                snippet: '<img src="/a.png" class="hero" width="10">',
                detail: {
                    alt: 'absent',
                    ancestor: null,
                    width: '10',
                    height: null,
                },
            },
            {
                check: 'img-alt-missing',
                url,
                subject: 'https://acme.com/a.png',
                selector: 'img.hero',
                snippet: '<img src="/a.png" class="hero" width="10">',
                detail: {
                    alt: 'absent',
                    ancestor: null,
                    width: '10',
                    height: null,
                },
            },
        ]);
    });

    it('decides an image with no alt by its aria name, then its title, then its figure', () => {
        expect(
            checks(`<img src="/a.png" aria-label="Chart" ${sized}>`),
        ).toEqual([]);

        expect(checks(`<img src="/a.png" title="Chart" ${sized}>`)).toEqual([
            'img-title-only',
        ]);

        expect(
            check(
                `<figure><img src="/a.png" ${sized}><figcaption>Sales</figcaption></figure>`,
            ),
        ).toMatchObject([
            { check: 'img-figure-no-alt', detail: { ancestor: 'figure' } },
        ]);

        expect(
            checks(
                `<figure><img src="/a.png" ${sized}><p>Note</p><figcaption>Sales</figcaption></figure>`,
            ),
        ).toEqual(['img-alt-missing']);
    });

    it('reports an alt of spaces and an editor’s blank marker, as an alt or an attribute', () => {
        expect(check(`<img src="/a.png" alt="  " ${sized}>`)).toMatchObject([
            { check: 'img-alt-whitespace', detail: { alt: 'whitespace' } },
        ]);

        expect(
            checks(
                `<img src="/a.png" alt="generator-unable-to-provide-required-alt" ${sized}><img src="/b.png" generator-unable-to-provide-required-alt="" ${sized}>`,
            ),
        ).toEqual(['img-generator-blank', 'img-generator-blank']);
    });

    it('reports a decorative image that takes focus or carries a title', () => {
        expect(
            checks(
                `<img src="/a.png" alt="" tabindex="0" ${sized}><img src="/b.png" role="presentation" tabindex="-1" ${sized}><img src="/c.png" alt="" title="Line" ${sized}>`,
            ),
        ).toEqual([
            'img-decorative-focusable',
            'img-decorative-focusable',
            'img-decorative-title',
        ]);
    });

    it('reports an alt that is the file name, with or without its extension, or a stock word', () => {
        expect(
            checks(
                `<img src="/img/Hero-Banner.JPG" alt="hero-banner.jpg" ${sized}><img src="/img/hero%20shot.png" alt="Hero Shot" ${sized}><img src="/x.png" alt="Logo" ${sized}><img src="/x.png" alt="Logo of Acme" ${sized}>`,
            ),
        ).toEqual(['img-alt-filename', 'img-alt-filename', 'img-alt-filename']);
    });

    it(`notes an alt over ${altMaxLength} characters, and reports one stuffed with a repeated word or 4 comma-separated terms`, () => {
        expect(
            checks(`<img src="/a.png" alt="${'a'.repeat(101)}" ${sized}>`),
        ).toEqual(['img-alt-long']);

        expect(
            checks(
                `<img src="/a.png" alt="puppy dog puppies puppy food puppy" ${sized}><img src="/b.png" alt="dog, pup, puppy, retriever" ${sized}><img src="/c.png" alt="Red, white and blue" ${sized}>`,
            ),
        ).toEqual(['img-alt-stuffed', 'img-alt-stuffed']);
    });

    it('notes an image in a link whose alt says what the link’s text says', () => {
        expect(
            check(
                `<a href="/"><img src="/logo.png" alt="Acme" ${sized}> ACME </a>`,
            ),
        ).toMatchObject([
            { check: 'img-alt-redundant', detail: { ancestor: 'link' } },
        ]);

        expect(
            checks(`<a href="/"><img src="/logo.png" alt="Acme" ${sized}></a>`),
        ).toEqual([]);
    });

    it('reports an image with no width or height and no aspect-ratio, a decorative one too', () => {
        expect(
            checks(
                '<img src="/a.png" alt="">' +
                    '<img src="/b.png" alt="A bird" width="10" height=" ">' +
                    '<img src="/c.png" alt="A cat" style="aspect-ratio: 16/9">',
            ),
        ).toEqual(['img-no-dimensions', 'img-no-dimensions']);
    });

    it('notes a camera or screenshot file name on an image with an alt, and not on a decorative one', () => {
        expect(
            checks(
                [
                    'IMG_1234.jpg',
                    'DSC_0001.JPG',
                    'PXL_20260101_120000.jpg',
                    'Screenshot%202026-01-01.png',
                    'Screen%20Shot%202026-01-01%20at%2010.00.png',
                    'image1.jpg',
                ]
                    .map((file) => `<img src="/${file}" alt="A view" ${sized}>`)
                    .join(''),
            ),
        ).toEqual(Array.from({ length: 6 }, () => 'img-filename-generic'));

        expect(
            checks(
                `<img src="/IMG_1234.jpg" alt="" ${sized}><img src="/imagery.jpg" alt="A view" ${sized}>`,
            ),
        ).toEqual([]);
    });

    it('reports an inline svg with role img and no name, and notes one with no role', () => {
        expect(
            check(
                '<svg role="img"><path d="M0"></path></svg><svg role="img"><title>Logo</title></svg><svg role="img" aria-label="Logo"></svg><svg></svg><svg role="presentation"></svg>',
            ),
        ).toMatchObject([
            {
                check: 'svg-no-name',
                subject: expect.stringMatching(/^[0-9a-f]{16}$/),
                snippet: '<svg role="img">',
                detail: { alt: 'absent' },
            },
            { check: 'svg-no-role', snippet: '<svg>' },
        ]);
    });

    it('reports an element with role img and no name', () => {
        expect(
            checks(
                '<i class="icon" role="img"></i><span role="img" aria-label="Star">★</span><span role="img" title="Star">★</span>',
            ),
        ).toEqual(['icon-no-name']);
    });

    it('reports a picture whose img has no src', () => {
        expect(
            check(
                `<picture><source srcset="/a.webp"><img alt="A bird" ${sized}></picture><picture><img src="/b.png" alt="A cat" ${sized}></picture>`,
            ),
        ).toMatchObject([{ check: 'picture-no-src', subject: null }]);
    });

    it('finds nothing on a picture with no img', () => {
        expect(check('<picture><source srcset="/a.webp"></picture>')).toEqual(
            [],
        );
    });

    it('keeps two inline svgs with one selector apart by their subject', () => {
        const [first, second] = check(
            '<svg class="icon"><title>Home</title></svg><svg class="icon"><title>Cart</title></svg>',
        );

        expect(first).toMatchObject({
            check: 'svg-no-role',
            selector: 'svg.icon',
        });

        expect(second).toMatchObject({
            check: 'svg-no-role',
            selector: 'svg.icon',
        });

        expect(first.subject).not.toBe(second.subject);
    });

    it(`cuts an alt the detail holds at ${snippetLength} characters`, () => {
        const [finding] = check(
            `<img src="/a.png" alt="${'a'.repeat(250)}" ${sized}>`,
        );

        const { alt } = finding.detail as { alt: string };

        expect(finding.check).toBe('img-alt-long');
        expect([...alt]).toHaveLength(snippetLength);
        expect(alt.endsWith('…')).toBe(true);
    });
});

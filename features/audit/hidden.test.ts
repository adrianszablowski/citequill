import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import { hidingStyle, inlineStyle, isHidden } from '@/features/audit/hidden';

function element(html: string) {
    const $ = cheerio.load(html);

    return $('#target').get(0)!;
}

describe('hidingStyle', () => {
    it('names display:none and visibility:hidden as none, in any case and spacing', () => {
        expect(hidingStyle('display: none')).toBe('none');
        expect(hidingStyle('color:red; VISIBILITY : Hidden')).toBe('none');
    });

    it('names a text-indent or left of -9999px or further as offscreen', () => {
        expect(hidingStyle('text-indent: -9999px')).toBe('offscreen');

        expect(hidingStyle('position:absolute; left: -10000px')).toBe(
            'offscreen',
        );
    });

    it('names a font-size or opacity of 0 as offscreen, in any unit', () => {
        expect(hidingStyle('font-size: 0')).toBe('offscreen');
        expect(hidingStyle('font-size:0px')).toBe('offscreen');
        expect(hidingStyle('font-size:0em')).toBe('offscreen');
        expect(hidingStyle('color:red; font-size:0rem')).toBe('offscreen');
        expect(hidingStyle('font-size:0%')).toBe('offscreen');
        expect(hidingStyle('opacity: 0')).toBe('offscreen');
        expect(hidingStyle('opacity:0.0; color:red')).toBe('offscreen');
    });

    it('names nothing for a smaller offset, a visible size or opacity, another property or no style', () => {
        expect(hidingStyle('text-indent: -20px')).toBeNull();
        expect(hidingStyle('left:-100px')).toBeNull();
        expect(hidingStyle('padding-left: -9999px')).toBeNull();
        expect(hidingStyle('font-size: 12px')).toBeNull();
        expect(hidingStyle('opacity: 0.5')).toBeNull();
        expect(hidingStyle('opacity:1')).toBeNull();
        expect(hidingStyle('display: block')).toBeNull();
        expect(hidingStyle(undefined)).toBeNull();
    });
});

describe('isHidden', () => {
    it('hides an element under aria-hidden, display:none, visibility:hidden or a template, on it or an ancestor', () => {
        expect(isHidden(element('<p id="target" aria-hidden="true">'))).toBe(
            true,
        );

        expect(
            isHidden(
                element('<div style="display:none"><p id="target"></p></div>'),
            ),
        ).toBe(true);

        expect(
            isHidden(element('<p id="target" style="visibility: hidden">')),
        ).toBe(true);

        expect(
            isHidden(element('<template><p id="target"></p></template>')),
        ).toBe(true);
    });

    it('leaves an element off screen or under hidden visible, because the images skip only what is not shown at all', () => {
        expect(
            isHidden(element('<p id="target" style="text-indent:-9999px">')),
        ).toBe(false);

        expect(isHidden(element('<p id="target" style="opacity:0">'))).toBe(
            false,
        );

        expect(isHidden(element('<p id="target" style="font-size:0">'))).toBe(
            false,
        );

        expect(isHidden(element('<p id="target" hidden>'))).toBe(false);
        expect(isHidden(element('<p id="target">'))).toBe(false);
    });
});

describe('inlineStyle', () => {
    it('lowercases a style and drops its whitespace', () => {
        expect(inlineStyle(' Aspect-Ratio : 16 / 9 ')).toBe(
            'aspect-ratio:16/9',
        );

        expect(inlineStyle(undefined)).toBe('');
    });
});

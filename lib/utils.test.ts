import { describe, expect, it } from 'vitest';

import { formatUsd, isWebUrl, pagesRead } from '@/lib/utils';

describe('formatUsd', () => {
    it('shows US dollars with two decimals, zero included', () => {
        expect(formatUsd(0)).toBe('$0.00');
        expect(formatUsd(3.126431)).toBe('$3.13');
        expect(formatUsd(1204.5)).toBe('$1,204.50');
    });
});

describe('pagesRead', () => {
    it('counts the pages read with the right plural', () => {
        expect(pagesRead(0)).toBe('No pages read yet.');
        expect(pagesRead(1)).toBe('1 page read so far.');
        expect(pagesRead(1204)).toBe('1,204 pages read so far.');
    });
});

describe('isWebUrl', () => {
    it('accepts an http or https address and nothing else', () => {
        expect(isWebUrl('https://cdn.acme.com/logo.png?w=200')).toBe(true);
        expect(isWebUrl('http://acme.com/a.jpg')).toBe(true);
        expect(isWebUrl('data:image/png;base64,iVBOR')).toBe(false);
        expect(isWebUrl('#icon-cart')).toBe(false);
        expect(isWebUrl('svg:3f2a9c')).toBe(false);
    });
});

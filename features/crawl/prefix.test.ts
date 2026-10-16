import { describe, expect, it } from 'vitest';

import { guessPrefix } from '@/features/crawl/prefix';

describe('guessPrefix', () => {
    it('picks the first candidate that some crawled path sits under', () => {
        const urls = [
            'https://acme.com/',
            'https://acme.com/Articles/first-post',
            'https://acme.com/blogroll',
        ];

        expect(guessPrefix(['/blog', '/articles'], urls)).toBe('/articles');
    });

    it('is empty when no path matches, or there are no pages', () => {
        expect(guessPrefix(['/blog'], ['https://acme.com/about'])).toBe('');
        expect(guessPrefix(['/blog'], [])).toBe('');
        expect(guessPrefix(['/blog'], ['not a url'])).toBe('');
    });
});

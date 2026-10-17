import { describe, expect, it } from 'vitest';

import { pagesRead } from '@/lib/utils';

describe('pagesRead', () => {
    it('counts the pages read with the right plural', () => {
        expect(pagesRead(0)).toBe('No pages read yet.');
        expect(pagesRead(1)).toBe('1 page read so far.');
        expect(pagesRead(1204)).toBe('1,204 pages read so far.');
    });
});

import { describe, expect, it } from 'vitest';

import { skillFolder } from '@/features/skills/folders';

describe('skillFolder', () => {
    it('puts a product skill in the product folder, even when a kind points at it', () => {
        expect(skillFolder({ is_product: true, page_kinds: [{}] })).toBe(
            'product',
        );
    });

    it('puts a skill a page kind points at in the kinds folder', () => {
        expect(skillFolder({ is_product: false, page_kinds: [{}] })).toBe(
            'kinds',
        );
    });

    it('puts every other skill in the custom folder', () => {
        expect(skillFolder({ is_product: false, page_kinds: [] })).toBe(
            'custom',
        );
    });
});

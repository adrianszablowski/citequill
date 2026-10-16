import { describe, expect, it } from 'vitest';

import { projectSchema } from '@/features/projects/schema';

describe('projectSchema', () => {
    it('keeps the host of a full address, without www', () => {
        expect(
            projectSchema.parse({
                domain: 'https://www.yoursite.com/blog?x=1',
            }),
        ).toEqual({ domain: 'yoursite.com' });

        expect(projectSchema.parse({ domain: 'www.yoursite.com' })).toEqual({
            domain: 'yoursite.com',
        });
    });

    it('accepts a bare domain and folds it to lowercase', () => {
        expect(projectSchema.parse({ domain: ' Shop.Example.COM ' })).toEqual({
            domain: 'shop.example.com',
        });
    });

    it('rejects a host without a dot and an empty address', () => {
        expect(projectSchema.safeParse({ domain: 'localhost' }).success).toBe(
            false,
        );

        expect(projectSchema.safeParse({ domain: '' }).success).toBe(false);
    });

    it('rejects an address that is not a host', () => {
        expect(projectSchema.safeParse({ domain: 'not a site' }).success).toBe(
            false,
        );
    });
});

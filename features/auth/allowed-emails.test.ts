import { describe, expect, it } from 'vitest';

import { isAllowedEmail } from '@/features/auth/allowed-emails';

describe('isAllowedEmail', () => {
    it('allows an address on the list', () => {
        expect(
            isAllowedEmail('a@example.com', 'a@example.com,b@example.com'),
        ).toBe(true);
    });

    it('folds case and whitespace on both sides', () => {
        expect(
            isAllowedEmail(' A@Example.com', 'b@example.com , a@example.com'),
        ).toBe(true);
    });

    it('denies an address off the list', () => {
        expect(
            isAllowedEmail('c@example.com', 'a@example.com,b@example.com'),
        ).toBe(false);
    });

    it('denies everyone when the list is empty', () => {
        expect(isAllowedEmail('a@example.com', '')).toBe(false);
    });

    it('denies a missing address', () => {
        expect(isAllowedEmail(undefined, 'a@example.com')).toBe(false);
    });
});

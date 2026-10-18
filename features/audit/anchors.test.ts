import { describe, expect, it } from 'vitest';

import { genericAnchors, isGenericAnchor } from '@/features/audit/anchors';

describe('isGenericAnchor', () => {
    it('holds the generic phrases of the decision, in English and Polish', () => {
        for (const phrase of ['click here', 'read more', 'czytaj więcej']) {
            expect(genericAnchors.has(phrase), phrase).toBe(true);
        }
    });

    it('compares the whole text in lower case, without punctuation and with whitespace collapsed', () => {
        expect(isGenericAnchor('Read more »')).toBe(true);
        expect(isGenericAnchor('  Click   HERE! ')).toBe(true);
        expect(isGenericAnchor('Czytaj więcej…')).toBe(true);
        expect(isGenericAnchor('Learn more →')).toBe(true);
        expect(isGenericAnchor('read-more')).toBe(true);
    });

    it('passes a text that only contains a generic phrase', () => {
        expect(isGenericAnchor('Read more about pricing')).toBe(false);
        expect(isGenericAnchor('Here is our pricing')).toBe(false);
        expect(isGenericAnchor('')).toBe(false);
    });

    it('treats a bare URL as generic, with or without its scheme', () => {
        expect(isGenericAnchor('https://acme.com/pricing')).toBe(true);
        expect(isGenericAnchor('www.acme.com')).toBe(true);
        expect(isGenericAnchor('acme.com pricing')).toBe(false);
        expect(isGenericAnchor('mailto:hi@acme.com')).toBe(false);
    });
});

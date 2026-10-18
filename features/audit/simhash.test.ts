import { describe, expect, it } from 'vitest';

import {
    hammingDistance,
    nearDuplicateBits,
    simhash,
    simhashBits,
} from '@/features/audit/simhash';

function prose(seed: string, length: number) {
    return Array.from({ length }, (_, i) => `${seed}${(i * 7919) % 997}`).join(
        ' ',
    );
}

function distance(one: string, other: string) {
    return hammingDistance(
        simhashBits(simhash(one)!),
        simhashBits(simhash(other)!),
    );
}

describe('simhash', () => {
    it('gives 16 lowercase hex characters, the same for the same text', () => {
        const text = prose('word', 200);

        expect(simhash(text)).toMatch(/^[0-9a-f]{16}$/);
        expect(simhash(text)).toBe(simhash(text));
    });

    it('reads tokens in lower case and ignores how they are spaced', () => {
        expect(simhash('The Quick  brown\nfox')).toBe(
            simhash('the quick brown fox'),
        );
    });

    it('keeps a text with one word changed in 200 within the near-duplicate bits', () => {
        const words = prose('word', 200).split(' ');
        const changed = [...words];

        changed[100] = 'different';

        expect(
            distance(words.join(' '), changed.join(' ')),
        ).toBeLessThanOrEqual(nearDuplicateBits);
    });

    it('puts two unrelated texts far apart', () => {
        expect(
            distance(prose('alpha', 200), prose('omega', 200)),
        ).toBeGreaterThan(nearDuplicateBits * 2);
    });

    it('hashes a text shorter than a shingle as one shingle', () => {
        expect(simhash('two words')).toMatch(/^[0-9a-f]{16}$/);
    });

    it('has no hash for an empty text', () => {
        expect(simhash('')).toBeNull();
        expect(simhash('  \n ')).toBeNull();
    });
});

describe('hammingDistance', () => {
    it('counts the differing bits of two hashes', () => {
        const zero = simhashBits('0000000000000000');

        expect(hammingDistance(zero, zero)).toBe(0);
        expect(hammingDistance(zero, simhashBits('ffffffffffffffff'))).toBe(64);
        expect(hammingDistance(zero, simhashBits('8000000100000003'))).toBe(4);
    });
});

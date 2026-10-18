import { createHash } from 'node:crypto';

export type SimhashBits = readonly [number, number];

export const nearDuplicateBits = 6;

export function simhash(text: string) {
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
        return null;
    }

    const weights = new Array<number>(64).fill(0);
    const shingles = Math.max(1, tokens.length - shingleSize + 1);

    for (let start = 0; start < shingles; start++) {
        const digest = createHash('sha256')
            .update(tokens.slice(start, start + shingleSize).join(' '))
            .digest();

        for (let bit = 0; bit < 64; bit++) {
            weights[bit] += (digest[bit >> 3] >> (7 - (bit & 7))) & 1 ? 1 : -1;
        }
    }

    let hex = '';

    for (let nibble = 0; nibble < 16; nibble++) {
        let value = 0;

        for (let bit = nibble * 4; bit < nibble * 4 + 4; bit++) {
            value = (value << 1) | (weights[bit] > 0 ? 1 : 0);
        }

        hex += value.toString(16);
    }

    return hex;
}

export function simhashBits(hash: string): SimhashBits {
    return [
        Number.parseInt(hash.slice(0, 8), 16),
        Number.parseInt(hash.slice(8, 16), 16),
    ];
}

export function hammingDistance(a: SimhashBits, b: SimhashBits) {
    return bitCount(a[0] ^ b[0]) + bitCount(a[1] ^ b[1]);
}

const shingleSize = 3;

function bitCount(value: number) {
    let rest = value >>> 0;
    let count = 0;

    while (rest !== 0) {
        rest &= rest - 1;
        count++;
    }

    return count;
}

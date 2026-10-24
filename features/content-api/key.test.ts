import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
    generateKey,
    isKey,
    keyHash,
    keyHint,
    keyPrefix,
} from '@/features/content-api/key';

describe('generateKey', () => {
    it('writes the prefix, 43 Base62 characters and a 6-character checksum', () => {
        const { key } = generateKey();

        expect(key).toMatch(/^cq_sk_[0-9A-Za-z]{49}$/);
        expect(isKey(key)).toBe(true);
    });

    it('makes a new key every time', () => {
        expect(generateKey().key).not.toBe(generateKey().key);
    });

    it('returns the SHA-256 of the key and its hint', () => {
        const { key, hash, hint } = generateKey();

        expect(hash).toBe(createHash('sha256').update(key).digest('hex'));
        expect(hint).toBe(`cq_sk_…${key.slice(-6)}`);
    });
});

describe('isKey', () => {
    const { key } = generateKey();

    it('takes a key whose checksum is the CRC32 of its 43 characters in Base62', () => {
        const body = key.slice(keyPrefix.length, -6);

        const checksum = Number(
            [...key.slice(-6)].reduce(
                (sum, digit) =>
                    sum * BigInt(62) +
                    BigInt(
                        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.indexOf(
                            digit,
                        ),
                    ),
                BigInt(0),
            ),
        );

        expect(checksum).toBe(crc32(body));
    });

    it('refuses a key with one character mistyped', () => {
        const index = keyPrefix.length + 10;
        const typo = key[index] === 'a' ? 'b' : 'a';

        expect(isKey(key.slice(0, index) + typo + key.slice(index + 1))).toBe(
            false,
        );
    });

    it('refuses a key with a missing character, another prefix or a space', () => {
        expect(isKey(key.slice(0, -1))).toBe(false);
        expect(isKey(key.replace(keyPrefix, 'cq_pk_'))).toBe(false);
        expect(isKey(` ${key}`)).toBe(false);
        expect(isKey('')).toBe(false);
    });
});

describe('keyHash', () => {
    it('is the hex SHA-256 of the key', () => {
        expect(keyHash('cq_sk_x')).toBe(
            createHash('sha256').update('cq_sk_x').digest('hex'),
        );
    });
});

describe('keyHint', () => {
    it('keeps the prefix and the last 6 characters', () => {
        expect(keyHint(`cq_sk_${'a'.repeat(43)}Zz0912`)).toBe('cq_sk_…Zz0912');
    });
});

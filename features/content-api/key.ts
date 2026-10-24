import { createHash, randomBytes } from 'node:crypto';
import { crc32 } from 'node:zlib';

export const keyPrefix = 'cq_sk_';

export const hintCharacters = 6;

const bodyCharacters = 43;

const checksumCharacters = 6;

export const secretCharacters = bodyCharacters + checksumCharacters;

export function generateKey() {
    const body = base62(
        BigInt(`0x${randomBytes(32).toString('hex')}`),
        bodyCharacters,
    );

    const key = `${keyPrefix}${body}${checksum(body)}`;

    return { key, hash: keyHash(key), hint: keyHint(key) };
}

export function isKey(value: string) {
    const match = keyPattern.exec(value);

    return match !== null && checksum(match[1]) === match[2];
}

export function keyHash(key: string) {
    return createHash('sha256').update(key).digest('hex');
}

export function keyHint(key: string) {
    return `${keyPrefix}…${key.slice(-hintCharacters)}`;
}

function checksum(body: string) {
    return base62(BigInt(crc32(body)), checksumCharacters);
}

function base62(value: bigint, length: number) {
    const base = BigInt(alphabet.length);
    let rest = value;
    let digits = '';

    while (rest > BigInt(0)) {
        digits = alphabet[Number(rest % base)] + digits;
        rest /= base;
    }

    return digits.padStart(length, alphabet[0]);
}

const alphabet =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const keyPattern = new RegExp(
    `^${keyPrefix}([0-9A-Za-z]{${bodyCharacters}})([0-9A-Za-z]{${checksumCharacters}})$`,
);

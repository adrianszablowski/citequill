import { describe, expect, it } from 'vitest';

import type { FetchDeps } from '@/features/crawl/fetch';
import {
    checkLogo,
    logoPixels,
    smallLogoWarning,
} from '@/features/publishing/logo';

describe('checkLogo', () => {
    it('reads the width and height of a PNG, a JPEG, a WebP and a GIF from their bytes', async () => {
        for (const bytes of [
            png(600, 120),
            jpeg(600, 120),
            webp(600, 120),
            gif(600, 120),
        ]) {
            expect(await check(answer(bytes))).toEqual({
                logo: { url, width: 600, height: 120 },
            });
        }
    });

    it("reads an SVG's width and height attributes in pixels before its viewBox", async () => {
        expect(
            await check(
                answer(
                    '<?xml version="1.0"?><!-- logo --><svg xmlns="http://www.w3.org/2000/svg" width="240px" height="60" viewBox="0 0 24 6"></svg>',
                ),
            ),
        ).toEqual({ logo: { url, width: 240, height: 60 } });
    });

    it("reads an SVG's viewBox when a width or height is missing or not in pixels", async () => {
        for (const attributes of [
            'width="240"',
            'width="100%" height="100%"',
            'width="2in" height="1in"',
            '',
        ]) {
            expect(
                await check(
                    answer(
                        `<svg ${attributes} viewBox="0,0 300.4 150"><path d="M0 0"/></svg>`,
                    ),
                ),
                attributes,
            ).toEqual({ logo: { url, width: 300, height: 150 } });
        }
    });

    it('refuses an SVG with no size it can read', async () => {
        for (const svg of [
            '<svg width="100%"></svg>',
            '<svg viewBox="0 0 200"></svg>',
            '<svg viewBox="0 0 Infinity 5"></svg>',
        ]) {
            expect(await check(answer(svg)), svg).toEqual({
                error: 'The SVG has no width and height in pixels and no viewBox Citequill can read. Add a viewBox to the file, or give a PNG logo.',
            });
        }
    });

    it('refuses a size that is not a whole number of pixels from 1 up to what the column holds', async () => {
        for (const body of [
            png(0, 0),
            png(4_000_000_000, 120),
            '<svg width="0" height="0" viewBox="0 0 0.4 0.4"></svg>',
            '<svg viewBox="0 0 1e12 1e12"></svg>',
            '<svg viewBox="0 0 -240 60"></svg>',
            `<svg width="${'9'.repeat(400)}" height="60"></svg>`,
        ]) {
            expect(await check(answer(body)), String(body)).toEqual({
                error: 'Citequill could not read a size in whole pixels from the image. Give another image of the logo.',
            });
        }
    });

    it('accepts the largest size the column holds', async () => {
        expect(await check(answer(png(2_147_483_647, 1)))).toEqual({
            logo: { url, width: 2_147_483_647, height: 1 },
        });
    });

    it('swaps the width and height of a JPEG its EXIF orientation turns', async () => {
        expect(await check(answer(jpeg(600, 120, 6)))).toEqual({
            logo: { url, width: 120, height: 600 },
        });

        expect(await check(answer(jpeg(600, 120, 3)))).toEqual({
            logo: { url, width: 600, height: 120 },
        });
    });

    it('reads the root of a 2 MB SVG of nested elements in well under a second', async () => {
        const svg = `<svg viewBox="0 0 240 60">${'<g>'.repeat(660_000)}`;
        const started = performance.now();

        expect(await check(answer(svg))).toEqual({
            logo: { url, width: 240, height: 60 },
        });

        expect(performance.now() - started).toBeLessThan(500);
    });

    it('refuses what is not one of the five image formats', async () => {
        for (const body of [
            '<!doctype html><html><body><svg viewBox="0 0 10 10"></svg></body></html>',
            Uint8Array.from([0x42, 0x4d, 0x3a, 0x00, 0x00, 0x00, 0x00, 0x00]),
            'not an image',
        ]) {
            expect(await check(answer(body))).toEqual({
                error: expect.stringContaining('PNG, JPEG, WebP, GIF or SVG'),
            });
        }
    });

    it('refuses an address that is not https, before it fetches anything', async () => {
        let isFetched = false;

        const result = await checkLogo('http://acme.com/logo.png', {
            fetch: async () => {
                isFetched = true;

                return answer(png(600, 120));
            },
            lookup: async () => ['93.184.216.34'],
        });

        expect(result).toEqual({ error: expect.stringContaining('https://') });
        expect(isFetched).toBe(false);
    });

    it('refuses a redirect to an http address, and an http hop between two https ones', async () => {
        const hops: Record<string, string> = {
            [url]: 'http://acme.com/logo.png',
            'http://acme.com/logo.png': 'https://cdn.acme.com/logo.png',
        };

        for (const end of [
            'http://acme.com/logo.png',
            'https://cdn.acme.com/logo.png',
        ]) {
            const result = await check((input) =>
                input !== end && hops[input]
                    ? new Response(null, {
                          status: 301,
                          headers: { location: hops[input] },
                      })
                    : answer(png(600, 120)),
            );

            expect(result, end).toEqual({
                error: expect.stringContaining('redirects through one'),
            });
        }
    });

    it('names the status of an answer other than 200', async () => {
        expect(await check(answer('', 404))).toEqual({
            error: expect.stringContaining('status 404'),
        });
    });

    it('says the logo could not be fetched when the request fails or the host is private', async () => {
        expect(
            await check(() => {
                throw new TypeError('fetch failed');
            }),
        ).toEqual({ error: expect.stringContaining('could not fetch') });

        expect(
            await checkLogo(url, {
                fetch: async () => answer(png(600, 120)),
                lookup: async () => ['10.0.0.1'],
            }),
        ).toEqual({ error: expect.stringContaining('could not fetch') });
    });
});

describe('smallLogoWarning', () => {
    it("warns under Google's minimum of 112 px on either side and is quiet at it", () => {
        expect(logoPixels).toBe(112);

        expect(smallLogoWarning({ width: 600, height: 100 })).toBe(
            "The logo is 600 by 100 px, under Google's minimum of 112 px on each side. Give a larger image when you have one.",
        );

        expect(smallLogoWarning({ width: 111, height: 400 })).not.toBeNull();
        expect(smallLogoWarning({ width: 112, height: 112 })).toBeNull();
    });
});

const url = 'https://acme.com/logo.png';

function check(respond: Response | ((input: string) => Response)) {
    const deps: FetchDeps = {
        fetch: async (input) =>
            typeof respond === 'function' ? respond(String(input)) : respond,
        lookup: async () => ['93.184.216.34'],
    };

    return checkLogo(url, deps);
}

function answer(body: BodyInit, status = 200) {
    return new Response(status === 200 ? body : null, { status });
}

function png(width: number, height: number) {
    const bytes = Buffer.alloc(33);

    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    bytes.writeUInt32BE(13, 8);
    bytes.write('IHDR', 12, 'latin1');
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);

    return new Uint8Array(bytes);
}

function jpeg(width: number, height: number, orientation?: number) {
    const sof = Buffer.alloc(11);

    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08]).copy(sof);
    sof.writeUInt16BE(height, 5);
    sof.writeUInt16BE(width, 7);

    return new Uint8Array(
        Buffer.concat([
            Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
            Buffer.from('JFIF\0', 'latin1'),
            Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0]),
            orientation === undefined ? Buffer.alloc(0) : exif(orientation),
            sof,
        ]),
    );
}

function exif(orientation: number) {
    const segment = Buffer.alloc(36);

    Buffer.from([0xff, 0xe1, 0x00, 0x22]).copy(segment);
    segment.write('Exif\0\0MM', 4, 'latin1');
    segment.writeUInt16BE(0x2a, 12);
    segment.writeUInt32BE(8, 14);
    segment.writeUInt16BE(1, 18);
    segment.writeUInt16BE(0x0112, 20);
    segment.writeUInt16BE(3, 22);
    segment.writeUInt32BE(1, 24);
    segment.writeUInt16BE(orientation, 28);

    return segment;
}

function webp(width: number, height: number) {
    const bytes = Buffer.alloc(30);

    bytes.write('RIFF', 0, 'latin1');
    bytes.writeUInt32LE(22, 4);
    bytes.write('WEBPVP8X', 8, 'latin1');
    bytes.writeUInt32LE(10, 16);
    bytes.writeUIntLE(width - 1, 24, 3);
    bytes.writeUIntLE(height - 1, 27, 3);

    return new Uint8Array(bytes);
}

function gif(width: number, height: number) {
    const bytes = Buffer.alloc(13);

    bytes.write('GIF89a', 0, 'latin1');
    bytes.writeUInt16LE(width, 6);
    bytes.writeUInt16LE(height, 8);

    return new Uint8Array(bytes);
}

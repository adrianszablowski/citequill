import * as cheerio from 'cheerio';
import { imageSize } from 'image-size';

import { type FetchDeps, fetchBytes } from '@/features/crawl/fetch';

export const logoPixels = 112;

export interface Logo {
    url: string;
    width: number;
    height: number;
}

export async function checkLogo(
    url: string,
    deps?: FetchDeps,
): Promise<{ logo: Logo } | { error: string }> {
    if (!isHttps(url)) {
        return {
            error: "The logo's address does not start with https://. Give the https address of the image.",
        };
    }

    const answer = await fetchBytes(url, deps).catch(() => null);

    if (!answer) {
        return {
            error: 'Citequill could not fetch the logo. Check the address and try again.',
        };
    }

    if (!answer.hops.every((hop) => isHttps(hop.url))) {
        return {
            error: "The logo's address redirects through one without https://. Give the https address the image opens at.",
        };
    }

    if (answer.status !== 200) {
        return {
            error: `The logo's address answered with status ${answer.status}. Give the address the image opens at.`,
        };
    }

    const size = rasterSize(answer.bytes) ?? svgSize(answer.bytes);

    if (size === null) {
        return {
            error: 'The address does not open a PNG, JPEG, WebP, GIF or SVG image. Give the address of the logo image itself.',
        };
    }

    if (size === 'unsized') {
        return {
            error: 'The SVG has no width and height in pixels and no viewBox Citequill can read. Add a viewBox to the file, or give a PNG logo.',
        };
    }

    if (!isPixelCount(size.width) || !isPixelCount(size.height)) {
        return {
            error: 'Citequill could not read a size in whole pixels from the image. Give another image of the logo.',
        };
    }

    return { logo: { url, ...size } };
}

export function smallLogoWarning({ width, height }: Omit<Logo, 'url'>) {
    return width < logoPixels || height < logoPixels
        ? `The logo is ${width} by ${height} px, under Google's minimum of ${logoPixels} px on each side. Give a larger image when you have one.`
        : null;
}

const rasterTypes = new Set(['png', 'jpg', 'webp', 'gif']);

const integerColumnMax = 2_147_483_647;

const svgHeadBytes = 64 * 1024;

function isHttps(url: string) {
    return URL.parse(url)?.protocol === 'https:';
}

function isPixelCount(value: number) {
    return Number.isInteger(value) && value >= 1 && value <= integerColumnMax;
}

function rasterSize(bytes: Uint8Array) {
    try {
        const { type = '', width, height, orientation = 1 } = imageSize(bytes);

        if (!rasterTypes.has(type)) {
            return null;
        }

        return orientation >= 5
            ? { width: height, height: width }
            : { width, height };
    } catch {
        return null;
    }
}

function svgSize(bytes: Uint8Array) {
    const head = new TextDecoder().decode(bytes.subarray(0, svgHeadBytes));
    const root = cheerio.load(head, { xml: true }).root().children('svg');

    if (root.length === 0) {
        return null;
    }

    const width = pixels(root.attr('width'));
    const height = pixels(root.attr('height'));

    if (width && height) {
        return { width, height };
    }

    const box = (root.attr('viewBox') ?? '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);

    return box.length === 4 && box.every(Number.isFinite)
        ? { width: Math.round(box[2]), height: Math.round(box[3]) }
        : 'unsized';
}

function pixels(value: string | undefined) {
    const length = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(value ?? '');

    return length ? Math.round(Number(length[1])) : 0;
}

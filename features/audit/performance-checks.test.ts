import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    assetWeightChecks,
    auditRegion,
    domSizeElements,
    heavyAssetBytes,
    heavyAssetFiles,
    isHtmlAnswer,
    isSlowRead,
    performanceChecks,
    slowHtmlMs,
    uncompressedMinBytes,
} from '@/features/audit/performance-checks';
import type { Fetched, Hop } from '@/features/crawl/fetch';

const url = 'https://acme.com/pricing';
const home = 'https://acme.com/';

const quiet = { elementCount: 10, assets: [] };

function fetched({
    headersMs = 100,
    hops = [{ url, status: 200 }],
    headers = { 'content-type': 'text/html', 'content-encoding': 'br' },
    body = '<p>Hi</p>',
}: {
    headersMs?: number;
    hops?: Hop[];
    headers?: Record<string, string>;
    body?: string;
} = {}): Fetched {
    const last = hops.at(-1)!;

    return {
        ok: last.status < 300,
        status: last.status,
        url: last.url,
        headers: new Headers(headers),
        body,
        isTruncated: false,
        hops,
        headersMs,
    };
}

function checks(...args: Parameters<typeof performanceChecks>) {
    return performanceChecks(...args).map((finding) => finding.check);
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('isHtmlAnswer', () => {
    it('calls a 200 HTML answer of one hop an HTML answer however long it took, and nothing else', () => {
        expect(isHtmlAnswer(fetched({ headersMs: 0 }))).toBe(true);

        expect(isHtmlAnswer(fetched({ hops: [{ url, status: 503 }] }))).toBe(
            false,
        );

        expect(
            isHtmlAnswer(
                fetched({
                    hops: [
                        { url, status: 301 },
                        { url: `${url}/`, status: 200 },
                    ],
                }),
            ),
        ).toBe(false);

        expect(
            isHtmlAnswer(
                fetched({ headers: { 'content-type': 'application/pdf' } }),
            ),
        ).toBe(false);
    });
});

describe('isSlowRead', () => {
    it(`calls a 200 HTML answer of one hop slow when its headers took over ${slowHtmlMs} ms`, () => {
        expect(isSlowRead(fetched({ headersMs: slowHtmlMs + 1 }))).toBe(true);
        expect(isSlowRead(fetched({ headersMs: slowHtmlMs }))).toBe(false);
    });

    it('never calls a redirect, an error or a file other than HTML slow, so they get no second read', () => {
        const headersMs = slowHtmlMs * 3;

        expect(
            isSlowRead(
                fetched({
                    headersMs,
                    hops: [
                        { url, status: 301 },
                        { url: `${url}/`, status: 200 },
                    ],
                }),
            ),
        ).toBe(false);

        expect(
            isSlowRead(fetched({ headersMs, hops: [{ url, status: 503 }] })),
        ).toBe(false);

        expect(
            isSlowRead(
                fetched({
                    headersMs,
                    headers: { 'content-type': 'application/pdf' },
                }),
            ),
        ).toBe(false);
    });
});

describe('performanceChecks, for html-slow', () => {
    it('reports a page whose two reads both took over the threshold, with both times and the region', () => {
        vi.stubEnv('VERCEL_REGION', 'fra1');

        expect(
            performanceChecks(url, fetched({ headersMs: 1240 }), quiet, 1810),
        ).toEqual([
            {
                check: 'html-slow',
                url,
                detail: { ms: [1240, 1810], region: 'fra1' },
            },
        ]);
    });

    it(`reports nothing when either read took ${slowHtmlMs} ms or less, or the second read gave no answer`, () => {
        expect(
            checks(url, fetched({ headersMs: slowHtmlMs }), quiet, 2000),
        ).toEqual([]);

        expect(
            checks(url, fetched({ headersMs: 2000 }), quiet, slowHtmlMs),
        ).toEqual([]);

        expect(
            checks(url, fetched({ headersMs: 2000 }), quiet, undefined),
        ).toEqual([]);
    });
});

describe('auditRegion', () => {
    it('names the Vercel region the function runs in, and local outside Vercel', () => {
        vi.stubEnv('VERCEL_REGION', 'iad1');
        expect(auditRegion()).toBe('iad1');

        vi.stubEnv('VERCEL_REGION', '');
        expect(auditRegion()).toBe('local');
    });
});

describe('performanceChecks, for html-uncompressed', () => {
    const plain = { 'content-type': 'text/html' };

    it(`reports a body over ${uncompressedMinBytes} bytes in UTF-8 with no Content-Encoding, and its size`, () => {
        const body = 'ż'.repeat(uncompressedMinBytes / 2 + 1);

        expect(
            performanceChecks(url, fetched({ headers: plain, body }), quiet, 0),
        ).toEqual([
            {
                check: 'html-uncompressed',
                url,
                detail: { bytes: uncompressedMinBytes + 2 },
            },
        ]);
    });

    it(`skips a body of ${uncompressedMinBytes} bytes or less, and a compressed one of any size`, () => {
        expect(
            checks(
                url,
                fetched({
                    headers: plain,
                    body: 'x'.repeat(uncompressedMinBytes),
                }),
                quiet,
                0,
            ),
        ).toEqual([]);

        expect(
            checks(
                url,
                fetched({
                    headers: { ...plain, 'content-encoding': 'gzip' },
                    body: 'x'.repeat(uncompressedMinBytes * 10),
                }),
                quiet,
                0,
            ),
        ).toEqual([]);
    });
});

describe('performanceChecks, for the page itself', () => {
    it(`reports over ${domSizeElements} elements, and nothing at ${domSizeElements}`, () => {
        expect(
            performanceChecks(
                url,
                fetched(),
                { elementCount: domSizeElements + 1, assets: [] },
                0,
            ),
        ).toEqual([
            {
                check: 'dom-size',
                url,
                detail: { elements: domSizeElements + 1 },
            },
        ]);

        expect(
            checks(
                url,
                fetched(),
                { elementCount: domSizeElements, assets: [] },
                0,
            ),
        ).toEqual([]);
    });

    it(`reports the files half of assets-heavy over ${heavyAssetFiles} scripts and stylesheets, and nothing at ${heavyAssetFiles}`, () => {
        const assets = (count: number) =>
            Array.from({ length: count }, (_, i) => `${home}${i}.js`);

        expect(
            performanceChecks(
                url,
                fetched(),
                { elementCount: 10, assets: assets(heavyAssetFiles + 1) },
                0,
            ),
        ).toEqual([
            {
                check: 'assets-heavy',
                url,
                detail: { reason: 'files', files: heavyAssetFiles + 1 },
            },
        ]);

        expect(
            checks(
                url,
                fetched(),
                { elementCount: 10, assets: assets(heavyAssetFiles) },
                0,
            ),
        ).toEqual([]);
    });
});

describe('assetWeightChecks', () => {
    const other = 'https://acme.de/';

    it(`reports a home page whose scripts and stylesheets weigh over ${heavyAssetBytes} bytes together, with their count`, () => {
        expect(
            assetWeightChecks(
                [home, other],
                [
                    { linked_from: [home], content_length: heavyAssetBytes },
                    {
                        linked_from: ['https://acme.com/a', home],
                        content_length: 1,
                    },
                    { linked_from: [home], content_length: null },
                    { linked_from: [other], content_length: heavyAssetBytes },
                ],
            ),
        ).toEqual([
            {
                check: 'assets-heavy',
                url: home,
                detail: {
                    reason: 'bytes',
                    bytes: heavyAssetBytes + 1,
                    files: 3,
                },
            },
        ]);
    });

    it('counts an asset without a Content-Length as 0 bytes, and reports nothing for a home page with no assets', () => {
        expect(
            assetWeightChecks(
                [home],
                Array.from({ length: 50 }, () => ({
                    linked_from: [home],
                    content_length: null,
                })),
            ),
        ).toEqual([]);

        expect(
            assetWeightChecks(
                [home],
                [
                    {
                        linked_from: ['https://acme.com/a'],
                        content_length: heavyAssetBytes * 2,
                    },
                ],
            ),
        ).toEqual([]);

        expect(assetWeightChecks([home], [])).toEqual([]);
    });
});

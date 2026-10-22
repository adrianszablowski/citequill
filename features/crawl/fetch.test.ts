import { gzipSync } from 'node:zlib';

import { describe, expect, it, vi } from 'vitest';

import {
    bingbotUserAgent,
    botSecretHeader,
    chromeVersion,
    desktopUserAgent,
    fetchBytes,
    type FetchDeps,
    fetchPublic,
    fetchText,
    googlebotUserAgent,
    isHtml,
    isPublicAddress,
    maxBytes,
    maxHops,
    phoneHeaders,
    phoneUserAgent,
    sitemapByteCap,
    tlsErrorOf,
    userAgent,
} from '@/features/crawl/fetch';

describe('userAgent', () => {
    it('names CitequillBot and points at the bot page', () => {
        expect(userAgent).toBe('CitequillBot/1.0 (+https://citequill.com/bot)');
    });

    it('names CitequillBot in the phone fetch too, after the user agent of Chrome on Android, and asks for the mobile page', () => {
        expect(phoneUserAgent).toMatch(
            /^Mozilla\/5\.0 \(Linux; Android 10; K\)/,
        );

        expect(phoneUserAgent).toContain(' Mobile Safari/537.36 ');
        expect(phoneUserAgent.endsWith(` ${userAgent}`)).toBe(true);

        expect(phoneHeaders).toEqual({
            'user-agent': phoneUserAgent,
            'sec-ch-ua-mobile': '?1',
        });
    });

    it('names CitequillBot in the desktop browser fetch, after the user agent of Chrome on Windows, with the Chrome version of the phone fetch', () => {
        expect(desktopUserAgent).toBe(
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 ${userAgent}`,
        );

        expect(phoneUserAgent).toContain(`Chrome/${chromeVersion} `);
    });

    it('names CitequillBot after the desktop user agents Google and Bing print for Googlebot and Bingbot', () => {
        expect(googlebotUserAgent).toBe(
            `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) ${userAgent}`,
        );

        expect(bingbotUserAgent).toBe(
            `Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) ${userAgent}`,
        );
    });
});

describe('tlsErrorOf', () => {
    const fetchFailed = (code: string) =>
        Object.assign(new TypeError('fetch failed'), {
            cause: Object.assign(new Error('certificate problem'), { code }),
        });

    it("reads the certificate and TLS version codes of Node's fetch from the cause", () => {
        for (const code of [
            'CERT_HAS_EXPIRED',
            'ERR_TLS_CERT_ALTNAME_INVALID',
            'DEPTH_ZERO_SELF_SIGNED_CERT',
            'SELF_SIGNED_CERT_IN_CHAIN',
            'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
            'UNABLE_TO_GET_ISSUER_CERT',
            'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
            'CERT_UNTRUSTED',
            'CERT_NOT_YET_VALID',
            'ERR_SSL_UNSUPPORTED_PROTOCOL',
            'ERR_TLS_HANDSHAKE_TIMEOUT',
            'ERR_SSL_WRONG_VERSION_NUMBER',
        ]) {
            expect(tlsErrorOf(fetchFailed(code)), code).toBe(code);
        }
    });

    it('reads the code of the error itself when there is no cause', () => {
        expect(
            tlsErrorOf(
                Object.assign(new Error('expired'), {
                    code: 'CERT_HAS_EXPIRED',
                }),
            ),
        ).toBe('CERT_HAS_EXPIRED');
    });

    it('gives null for a time-out, a refused connection, a guard error or no error', () => {
        for (const error of [
            fetchFailed('ECONNREFUSED'),
            fetchFailed('ENOTFOUND'),
            new DOMException('The operation timed out.', 'TimeoutError'),
            new Error('acme.com points at a private address.'),
            Object.assign(new TypeError('fetch failed'), { cause: 'text' }),
            null,
            undefined,
        ]) {
            expect(tlsErrorOf(error)).toBeNull();
        }
    });
});

describe('fetchText', () => {
    it('gives the body of a page that answers and null for one that fails or is refused', async () => {
        const deps = fakeDeps({
            'https://acme.com/llms.txt': page('# Acme'),
            'https://acme.com/missing': new Response('', { status: 404 }),
        });

        expect(await fetchText('https://acme.com/llms.txt', deps)).toBe(
            '# Acme',
        );

        expect(await fetchText('https://acme.com/missing', deps)).toBeNull();
        expect(await fetchText('https://acme.com/unknown', deps)).toBeNull();
    });
});

describe('fetchBytes', () => {
    it('gives the bytes of the answer as they came, with its status and final address', async () => {
        const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0x00, 0xfe]);

        const deps = fakeDeps({
            'https://acme.com/logo.png': redirect(
                'https://cdn.acme.com/logo.png',
            ),
            'https://cdn.acme.com/logo.png': new Response(png),
        });

        const result = await fetchBytes('https://acme.com/logo.png', deps);

        expect(result.status).toBe(200);
        expect(result.url).toBe('https://cdn.acme.com/logo.png');

        expect(result.hops).toEqual([
            { url: 'https://acme.com/logo.png', status: 302 },
            { url: 'https://cdn.acme.com/logo.png', status: 200 },
        ]);

        expect([...result.bytes]).toEqual([...png]);
    });

    it('cuts a body over 2 MB at the cap', async () => {
        const deps = fakeDeps({
            'https://acme.com/logo.png': new Response(
                new Uint8Array(maxBytes + 100_000).fill(7),
            ),
        });

        const { bytes } = await fetchBytes('https://acme.com/logo.png', deps);

        expect(bytes).toHaveLength(maxBytes);
    });

    it('refuses a private address and fails an answer that stops partway', async () => {
        await expect(
            fetchBytes(
                'https://intranet.acme.com/logo.png',
                fakeDeps({}, { 'intranet.acme.com': ['10.1.2.3'] }),
            ),
        ).rejects.toThrow('private address');

        const deps = fakeDeps({
            'https://acme.com/logo.png': stopping(
                [new Uint8Array([1, 2, 3])],
                new TypeError('terminated'),
            ),
        });

        await expect(
            fetchBytes('https://acme.com/logo.png', deps),
        ).rejects.toThrow('terminated');
    });
});

describe('isPublicAddress', () => {
    it('refuses loopback, private, link-local, carrier NAT and metadata addresses', () => {
        for (const address of [
            '127.0.0.1',
            '127.1.2.3',
            '10.0.0.1',
            '172.16.0.1',
            '172.31.255.255',
            '192.168.1.1',
            '169.254.169.254',
            '100.64.0.1',
            '0.0.0.0',
            '::1',
            '::',
            'fe80::1',
            'fd00::1',
            '::ffff:10.0.0.1',
            '::ffff:127.0.0.1',
            'not an address',
        ]) {
            expect(isPublicAddress(address), address).toBe(false);
        }
    });

    it('accepts public addresses', () => {
        for (const address of ['8.8.8.8', '76.76.21.21', '2606:4700::1111']) {
            expect(isPublicAddress(address), address).toBe(true);
        }
    });
});

describe('fetchPublic', () => {
    it('follows redirects by hand and reports the final address', async () => {
        const deps = fakeDeps({
            'https://acme.com/': redirect('https://www.acme.com/'),
            'https://www.acme.com/': page('<h1>Acme</h1>'),
        });

        const result = await fetchPublic('https://acme.com/', deps);

        expect(result.url).toBe('https://www.acme.com/');
        expect(result.body).toBe('<h1>Acme</h1>');
        expect(result.ok).toBe(true);
    });

    it('refuses a redirect into a private address', async () => {
        const deps = fakeDeps(
            {
                'https://acme.com/': redirect('http://127.0.0.1:3000/'),
            },
            { 'acme.com': ['93.184.216.34'] },
        );

        await expect(fetchPublic('https://acme.com/', deps)).rejects.toThrow(
            'private address',
        );
    });

    it('refuses a host that resolves to a private address', async () => {
        const deps = fakeDeps({}, { 'intranet.acme.com': ['10.1.2.3'] });

        await expect(
            fetchPublic('https://intranet.acme.com/', deps),
        ).rejects.toThrow('private address');
    });

    it('refuses schemes other than http and https', async () => {
        await expect(
            fetchPublic('ftp://acme.com/file', fakeDeps({})),
        ).rejects.toThrow('not an http or https address');
    });

    it('stops after ten hops and returns the redirect it ended on with the chain', async () => {
        const deps = fakeDeps({
            'https://acme.com/': redirect('https://acme.com/'),
        });

        const result = await fetchPublic('https://acme.com/', deps);

        expect(result.ok).toBe(false);
        expect(result.status).toBe(302);
        expect(result.hops).toHaveLength(maxHops + 1);
    });

    it('records every hop with its status', async () => {
        const deps = fakeDeps({
            'https://acme.com/a': redirect('/b', 301),
            'https://acme.com/b': redirect('https://www.acme.com/b'),
            'https://www.acme.com/b': page('<h1>B</h1>'),
        });

        const result = await fetchPublic('https://acme.com/a', deps);

        expect(result.hops).toEqual([
            { url: 'https://acme.com/a', status: 301 },
            { url: 'https://acme.com/b', status: 302 },
            { url: 'https://www.acme.com/b', status: 200 },
        ]);
    });

    it('sends the bot secret to the site hosts only and drops it on a hop off the site', async () => {
        const { deps, sent } = recordingDeps({
            'https://acme.com/': redirect('https://www.acme.com/'),
            'https://www.acme.com/': redirect('https://cdn.other.com/page'),
            'https://cdn.other.com/page': page('<h1>Elsewhere</h1>'),
        });

        await fetchPublic('https://acme.com/', deps, {
            botSecret: { value: 's3cret', hosts: ['acme.com', 'www.acme.com'] },
        });

        expect(sent.map((request) => request.secret)).toEqual([
            's3cret',
            's3cret',
            null,
        ]);

        expect(sent.every((request) => request.userAgent === userAgent)).toBe(
            true,
        );
    });

    it('asks with HEAD without reading a body and lets a header replace a default', async () => {
        const { deps, sent } = recordingDeps({
            'https://acme.com/': page('<h1>Acme</h1>'),
        });

        const result = await fetchPublic('https://acme.com/', deps, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Phone' },
        });

        expect(result.body).toBe('');

        expect(sent).toEqual([
            {
                method: 'HEAD',
                userAgent: 'Phone',
                encoding: 'gzip, br',
                secret: null,
            },
        ]);
    });

    it('times each answer from its request to its headers and keeps the time of the final hop', async () => {
        const answers = fakeDeps({
            'https://acme.com/': redirect('https://www.acme.com/'),
            'https://www.acme.com/': page('<h1>Acme</h1>'),
        });

        const waits: Record<string, number> = {
            'https://acme.com/': 120,
            'https://www.acme.com/': 40,
        };

        const deps: FetchDeps = {
            ...answers,
            fetch: async (input, init) => {
                await new Promise((resolve) =>
                    setTimeout(resolve, waits[String(input)]),
                );

                return answers.fetch(input, init);
            },
        };

        vi.useFakeTimers();

        try {
            const fetched = fetchPublic('https://acme.com/', deps);

            await vi.advanceTimersByTimeAsync(160);

            expect((await fetched).headersMs).toBe(40);
        } finally {
            vi.useRealTimers();
        }
    });

    it('cuts the body at the size cap and says it did', async () => {
        const deps = fakeDeps({
            'https://acme.com/': page('x'.repeat(maxBytes + 1000)),
            'https://acme.com/small': page('x'.repeat(maxBytes)),
        });

        const result = await fetchPublic('https://acme.com/', deps);

        expect(result.body).toHaveLength(maxBytes);
        expect(result.isTruncated).toBe(true);

        expect(
            (await fetchPublic('https://acme.com/small', deps)).isTruncated,
        ).toBe(false);
    });

    it('says a body is cut when more follows a chunk that ends exactly at the cap', async () => {
        const result = await fetchPublic(
            'https://acme.com/',
            fakeDeps({
                'https://acme.com/': streamed([
                    Buffer.alloc(maxBytes, 'x'),
                    Buffer.from('y'),
                ]),
            }),
        );

        expect(result.body).toHaveLength(maxBytes);
        expect(result.isTruncated).toBe(true);
        expect(result.bytes).toBe(maxBytes + 1);
    });

    it('reads a sitemap up to 50 MB and unpacks a gzipped one, counting its size after unpacking', async () => {
        const xml = '<urlset></urlset>';

        const deps = fakeDeps({
            'https://acme.com/big.xml': page('x'.repeat(maxBytes + 1000)),
            'https://acme.com/sitemap.xml.gz': gzipped(xml),
        });

        const big = await fetchPublic('https://acme.com/big.xml', deps, {
            isSitemap: true,
        });

        expect(big.body).toHaveLength(maxBytes + 1000);
        expect(big.isTruncated).toBe(false);

        const packed = await fetchPublic(
            'https://acme.com/sitemap.xml.gz',
            deps,
            { isSitemap: true },
        );

        expect(packed).toMatchObject({
            body: xml,
            bytes: xml.length,
            isTruncated: false,
        });
    });

    it('cuts an unpacked sitemap at 50 MB and lets a file of exactly 50 MB through', async () => {
        const deps = fakeDeps({
            'https://acme.com/over.xml.gz': gzipped(
                'x'.repeat(sitemapByteCap + 1),
            ),
            'https://acme.com/exact.xml.gz': gzipped(
                'x'.repeat(sitemapByteCap),
            ),
            'https://acme.com/exact.xml': page('x'.repeat(sitemapByteCap)),
        });

        const over = await fetchPublic('https://acme.com/over.xml.gz', deps, {
            isSitemap: true,
        });

        expect(over.body).toHaveLength(sitemapByteCap);
        expect(over.isTruncated).toBe(true);
        expect(over.bytes).toBeGreaterThan(sitemapByteCap);

        for (const url of [
            'https://acme.com/exact.xml.gz',
            'https://acme.com/exact.xml',
        ]) {
            const exact = await fetchPublic(url, deps, { isSitemap: true });

            expect(exact.body, url).toHaveLength(sitemapByteCap);
            expect(exact.isTruncated, url).toBe(false);
            expect(exact.bytes, url).toBe(sitemapByteCap);
        }
    });

    it('gives what a cut gzip stream holds and says the read is cut', async () => {
        const xml = Array.from(
            { length: 5_000 },
            (_, i) => `<url><loc>https://acme.com/${i}</loc></url>`,
        ).join('');

        const packed = gzipSync(xml);

        const cut = await fetchPublic(
            'https://acme.com/sitemap.xml.gz',
            fakeDeps({
                'https://acme.com/sitemap.xml.gz': new Response(
                    packed.subarray(0, packed.length / 2),
                ),
            }),
            { isSitemap: true },
        );

        expect(cut.isTruncated).toBe(true);
        expect(cut.body.length).toBeGreaterThan(0);
        expect(xml.startsWith(cut.body)).toBe(true);
    });

    it('stops unpacking a gzip bomb at the cap', async () => {
        const member = gzipSync(Buffer.alloc(1024 * 1024));

        const bomb = Buffer.concat(Array.from({ length: 200 }, () => member));

        const result = await fetchPublic(
            'https://acme.com/sitemap.xml.gz',
            fakeDeps({ 'https://acme.com/sitemap.xml.gz': new Response(bomb) }),
            { isSitemap: true },
        );

        expect(bomb.length).toBeLessThan(maxBytes);
        expect(result.body).toHaveLength(sitemapByteCap);
        expect(result.isTruncated).toBe(true);
        expect(result.bytes).toBeLessThan(sitemapByteCap + 1024 * 1024);
    });

    it('judges a gzipped sitemap with bytes after its stream on what it gave, as a cut file', async () => {
        const xml = sitemapXml(5_000);

        const result = await fetchPublic(
            'https://acme.com/sitemap.xml.gz',
            fakeDeps({
                'https://acme.com/sitemap.xml.gz': new Response(
                    Buffer.concat([gzipSync(xml), Buffer.from('garbage')]),
                ),
            }),
            { isSitemap: true },
        );

        expect(result.isTruncated).toBe(true);
        expect(result.body.length).toBeGreaterThan(0);
        expect(xml.startsWith(result.body)).toBe(true);
    });

    it('keeps what a sitemap gave before its answer stopped, plain or gzipped, and says the read is cut', async () => {
        const xml = Buffer.from(sitemapXml(5_000));
        const packed = gzipSync(xml);

        for (const error of [
            new DOMException('The operation timed out.', 'TimeoutError'),
            Object.assign(new TypeError('terminated'), {
                cause: Object.assign(new Error('other side closed'), {
                    code: 'UND_ERR_SOCKET',
                }),
            }),
        ]) {
            for (const [url, body] of [
                ['https://acme.com/sitemap.xml', xml],
                ['https://acme.com/sitemap.xml.gz', packed],
            ] as const) {
                const result = await fetchPublic(
                    url,
                    fakeDeps({
                        [url]: stopping(
                            [
                                body.subarray(0, body.length / 4),
                                body.subarray(body.length / 4, body.length / 2),
                            ],
                            error,
                        ),
                    }),
                    { isSitemap: true },
                );

                expect(result.isTruncated, url).toBe(true);
                expect(result.body.length, url).toBeGreaterThan(0);
                expect(xml.toString().startsWith(result.body), url).toBe(true);
            }
        }
    });

    it('fails a page whose answer stops partway', async () => {
        await expect(
            fetchPublic(
                'https://acme.com/',
                fakeDeps({
                    'https://acme.com/': stopping(
                        [Buffer.from('<h1>Acme</h1>')],
                        new TypeError('terminated'),
                    ),
                }),
            ),
        ).rejects.toThrow('terminated');
    });

    it('never unpacks a page that starts with the gzip bytes', async () => {
        const packed = gzipSync('<h1>Acme</h1>');

        const result = await fetchPublic(
            'https://acme.com/',
            fakeDeps({ 'https://acme.com/': new Response(packed) }),
        );

        expect(result.bytes).toBe(packed.length);
        expect(result.body).not.toContain('Acme');
    });

    it('says whether the bytes are UTF-8, a byte order mark included', async () => {
        const deps = fakeDeps({
            'https://acme.com/utf8.xml': new Response(
                Buffer.from('﻿<urlset>zażółć</urlset>'),
            ),
            'https://acme.com/latin.xml': new Response(
                Buffer.from('<urlset>caf\xe9</urlset>', 'latin1'),
            ),
        });

        const utf8 = await fetchPublic('https://acme.com/utf8.xml', deps, {
            isSitemap: true,
        });

        expect(utf8).toMatchObject({
            body: '<urlset>zażółć</urlset>',
            isUtf8: true,
        });

        expect(
            (
                await fetchPublic('https://acme.com/latin.xml', deps, {
                    isSitemap: true,
                })
            ).isUtf8,
        ).toBe(false);
    });
});

describe('isHtml', () => {
    it('accepts html and missing content types and refuses the rest', () => {
        expect(isHtml(new Headers({ 'content-type': 'text/html' }))).toBe(true);

        expect(
            isHtml(new Headers({ 'content-type': 'text/html; charset=utf-8' })),
        ).toBe(true);

        expect(isHtml(new Headers())).toBe(true);

        expect(isHtml(new Headers({ 'content-type': 'application/pdf' }))).toBe(
            false,
        );
    });
});

function page(body: string) {
    return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/html' },
    });
}

function gzipped(body: string) {
    return new Response(gzipSync(body), {
        status: 200,
        headers: { 'content-type': 'application/gzip' },
    });
}

function streamed(chunks: Uint8Array[]) {
    return new Response(
        new ReadableStream({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(chunk);
                }

                controller.close();
            },
        }),
    );
}

function stopping(chunks: Uint8Array[], error: unknown) {
    let sent = 0;

    return new Response(
        new ReadableStream({
            pull(controller) {
                if (sent < chunks.length) {
                    controller.enqueue(chunks[sent]);
                    sent += 1;
                } else {
                    controller.error(error);
                }
            },
        }),
    );
}

function sitemapXml(count: number) {
    return `<urlset>${Array.from(
        { length: count },
        (_, i) => `<url><loc>https://acme.com/${i}</loc></url>`,
    ).join('')}</urlset>`;
}

function redirect(location: string, status = 302) {
    return new Response(null, { status, headers: { location } });
}

function recordingDeps(responses: Record<string, Response>) {
    const sent: {
        method: string | undefined;
        userAgent: string | null;
        encoding: string | null;
        secret: string | null;
    }[] = [];

    const inner = fakeDeps(responses);

    const deps: FetchDeps = {
        ...inner,
        fetch: async (input, init) => {
            const headers = new Headers(init?.headers);

            sent.push({
                method: init?.method,
                userAgent: headers.get('user-agent'),
                encoding: headers.get('accept-encoding'),
                secret: headers.get(botSecretHeader),
            });

            return inner.fetch(input, init);
        },
    };

    return { deps, sent };
}

function fakeDeps(
    responses: Record<string, Response>,
    hosts: Record<string, string[]> = {},
): FetchDeps {
    return {
        fetch: async (input) => {
            const response = responses[String(input)];

            if (!response) {
                throw new Error(`No response for ${String(input)}`);
            }

            return response;
        },
        lookup: async (hostname) => hosts[hostname] ?? ['93.184.216.34'],
    };
}

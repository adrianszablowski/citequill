import { describe, expect, it, vi } from 'vitest';

import {
    bingbotUserAgent,
    botSecretHeader,
    chromeVersion,
    desktopUserAgent,
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

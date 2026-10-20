import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { createGunzip } from 'node:zlib';

export const userAgent = 'CitequillBot/1.0 (+https://citequill.com/bot)';

export const chromeVersion = '130.0.0.0';

export const phoneUserAgent = `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36 ${userAgent}`;

export const desktopUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 ${userAgent}`;

export const googlebotUserAgent = `Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) ${userAgent}`;

export const bingbotUserAgent = `Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) ${userAgent}`;

export const phoneHeaders = {
    'user-agent': phoneUserAgent,
    'sec-ch-ua-mobile': '?1',
};

export const botSecretHeader = 'citequill-bot-secret';

export const timeoutMs = 15_000;

export const maxBytes = 2_000_000;

export const sitemapByteCap = 50 * 1024 * 1024;

export const maxHops = 10;

export interface Hop {
    url: string;
    status: number;
}

export interface Fetched {
    ok: boolean;
    status: number;
    url: string;
    headers: Headers;
    body: string;
    bytes: number;
    isUtf8: boolean;
    isTruncated: boolean;
    hops: Hop[];
    headersMs: number;
}

export interface FetchDeps {
    fetch: typeof fetch;
    lookup: (hostname: string) => Promise<string[]>;
}

export interface FetchOptions {
    method?: 'GET' | 'HEAD';
    headers?: Record<string, string>;
    botSecret?: { value: string; hosts: string[] };
    isSitemap?: boolean;
}

export async function fetchPublic(
    url: string,
    deps: FetchDeps = defaultDeps,
    {
        method = 'GET',
        headers = {},
        botSecret,
        isSitemap = false,
    }: FetchOptions = {},
): Promise<Fetched> {
    const signal = AbortSignal.timeout(timeoutMs);
    const hops: Hop[] = [];
    let current = new URL(url);

    for (;;) {
        await assertPublic(current, deps.lookup);

        const sent = new Headers({
            'user-agent': userAgent,
            accept: 'text/html,*/*',
            'accept-encoding': 'gzip, br',
        });

        for (const [name, value] of Object.entries(headers)) {
            sent.set(name, value);
        }

        if (botSecret?.hosts.includes(current.hostname)) {
            sent.set(botSecretHeader, botSecret.value);
        }

        const sentAt = Date.now();

        const response = await deps.fetch(current.href, {
            method,
            headers: sent,
            redirect: 'manual',
            signal,
        });

        const headersMs = Date.now() - sentAt;

        hops.push({ url: current.href, status: response.status });

        const location = response.headers.get('location');

        if (
            response.status >= 300 &&
            response.status < 400 &&
            location &&
            hops.length <= maxHops
        ) {
            await response.body?.cancel();
            current = new URL(location, current);

            continue;
        }

        if (method === 'HEAD') {
            await response.body?.cancel();
        }

        const read =
            method === 'HEAD'
                ? { body: '', bytes: 0, isUtf8: true, isTruncated: false }
                : await readBody(response, isSitemap);

        return {
            ok: response.ok,
            status: response.status,
            url: current.href,
            headers: response.headers,
            ...read,
            hops,
            headersMs,
        };
    }
}

export async function fetchText(url: string, deps?: FetchDeps) {
    try {
        const response = await fetchPublic(url, deps);

        return response.ok ? response.body : null;
    } catch {
        return null;
    }
}

export function isPublicAddress(address: string) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);

    if (mapped) {
        return isPublicAddress(mapped[1]);
    }

    const family = isIP(address);

    if (family === 0) {
        return false;
    }

    return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export function isHtml(headers: Headers) {
    const type = headers.get('content-type') ?? '';

    return type === '' || /^(text\/html|application\/xhtml\+xml)/i.test(type);
}

export function tlsErrorOf(error: unknown) {
    const { code, cause } = (error ?? {}) as {
        code?: unknown;
        cause?: { code?: unknown };
    };

    return (
        [cause?.code, code].find(
            (candidate): candidate is string =>
                typeof candidate === 'string' &&
                (tlsCodes.has(candidate) || /^ERR_(TLS|SSL)_/.test(candidate)),
        ) ?? null
    );
}

export const defaultDeps: FetchDeps = {
    fetch,
    lookup: async (hostname) =>
        (await dnsLookup(hostname, { all: true })).map(
            (entry) => entry.address,
        ),
};

const tlsCodes = new Set([
    'CERT_HAS_EXPIRED',
    'CERT_NOT_YET_VALID',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'UNABLE_TO_GET_ISSUER_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'CERT_UNTRUSTED',
]);

const utf8 = new TextDecoder('utf-8', { fatal: true });

const blocked = new BlockList();

for (const [address, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
] as const) {
    blocked.addSubnet(address, prefix, 'ipv4');
}

for (const [address, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['64:ff9b::', 96],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
] as const) {
    blocked.addSubnet(address, prefix, 'ipv6');
}

async function assertPublic(url: URL, lookup: FetchDeps['lookup']) {
    if (!/^https?:$/.test(url.protocol)) {
        throw new Error(`${url.href} is not an http or https address.`);
    }

    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [host] : await lookup(host);

    if (addresses.length === 0) {
        throw new Error(`${host} has no address.`);
    }

    if (!addresses.every(isPublicAddress)) {
        throw new Error(`${host} points at a private address.`);
    }
}

async function readBody(response: Response, isSitemap: boolean) {
    const limit = isSitemap ? sitemapByteCap : maxBytes;
    const raw = await readBytes(response, limit);

    if (raw.error !== null && !isSitemap) {
        throw raw.error;
    }

    const read =
        isSitemap && raw.bytes[0] === 0x1f && raw.bytes[1] === 0x8b
            ? await gunzipped(raw.bytes, limit)
            : { ...raw, isCut: false };

    return {
        ...decoded(read.bytes.subarray(0, limit), response.headers),
        bytes: read.size,
        isTruncated:
            raw.size > limit ||
            raw.error !== null ||
            read.isCut ||
            read.size > limit,
    };
}

async function readBytes(response: Response, limit: number) {
    if (!response.body) {
        return { bytes: Buffer.alloc(0), size: 0, error: null };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    try {
        while (size <= limit) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            size += value.byteLength;
        }

        await reader.cancel();
    } catch (error) {
        return { bytes: Buffer.concat(chunks), size, error };
    }

    return { bytes: Buffer.concat(chunks), size, error: null };
}

// A gzip stream the server cut ends in Z_BUF_ERROR after giving every byte it
// holds, and trailing bytes after the stream end in Z_DATA_ERROR, so an error
// once output has started is a cut file, judged on what it gave.
async function gunzipped(packed: Buffer, limit: number) {
    const gunzip = createGunzip();
    const chunks: Buffer[] = [];
    let size = 0;
    let isCut = false;

    gunzip.end(packed);

    try {
        for await (const chunk of gunzip as AsyncIterable<Buffer>) {
            chunks.push(chunk);
            size += chunk.byteLength;

            if (size > limit) {
                break;
            }
        }
    } catch (error) {
        isCut =
            size > 0 || (error as { code?: unknown }).code === 'Z_BUF_ERROR';
    }

    return { bytes: Buffer.concat(chunks), size, isCut };
}

function decoded(bytes: Uint8Array, headers: Headers) {
    const lenient = decoder(headers);

    try {
        const text = utf8.decode(bytes);

        return {
            body: lenient.encoding === 'utf-8' ? text : lenient.decode(bytes),
            isUtf8: true,
        };
    } catch {
        return { body: lenient.decode(bytes), isUtf8: false };
    }
}

function decoder(headers: Headers) {
    const charset = /charset=["']?([\w-]+)/i.exec(
        headers.get('content-type') ?? '',
    )?.[1];

    try {
        return new TextDecoder(charset ?? 'utf-8');
    } catch {
        return new TextDecoder();
    }
}

import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export const userAgent = 'CitequillBot/0.1 (+https://citequill.com)';

export const timeoutMs = 15_000;

export const maxBytes = 2_000_000;

export const maxHops = 5;

export interface Fetched {
    ok: boolean;
    status: number;
    url: string;
    headers: Headers;
    body: string;
}

export interface FetchDeps {
    fetch: typeof fetch;
    lookup: (hostname: string) => Promise<string[]>;
}

export async function fetchPublic(
    url: string,
    deps: FetchDeps = defaultDeps,
): Promise<Fetched> {
    const signal = AbortSignal.timeout(timeoutMs);
    let current = new URL(url);

    for (let hop = 0; hop <= maxHops; hop++) {
        await assertPublic(current, deps.lookup);

        const response = await deps.fetch(current.href, {
            headers: { 'user-agent': userAgent, accept: 'text/html,*/*' },
            redirect: 'manual',
            signal,
        });

        const location = response.headers.get('location');

        if (response.status >= 300 && response.status < 400 && location) {
            await response.body?.cancel();
            current = new URL(location, current);

            continue;
        }

        return {
            ok: response.ok,
            status: response.status,
            url: current.href,
            headers: response.headers,
            body: await readBody(response, maxBytes),
        };
    }

    throw new Error(`${url} redirects more than ${maxHops} times.`);
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

const defaultDeps: FetchDeps = {
    fetch,
    lookup: async (hostname) =>
        (await dnsLookup(hostname, { all: true })).map(
            (entry) => entry.address,
        ),
};

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

async function readBody(response: Response, limit: number) {
    if (!response.body) {
        return '';
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    while (size < limit) {
        const { done, value } = await reader.read();

        if (done) {
            break;
        }

        chunks.push(value);
        size += value.byteLength;
    }

    await reader.cancel();

    return decoder(response.headers).decode(
        Buffer.concat(chunks).subarray(0, limit),
    );
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

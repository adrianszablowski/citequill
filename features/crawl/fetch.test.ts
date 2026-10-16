import { describe, expect, it } from 'vitest';

import {
    type FetchDeps,
    fetchPublic,
    fetchText,
    isHtml,
    isPublicAddress,
    maxBytes,
} from '@/features/crawl/fetch';

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

    it('gives up after too many redirects', async () => {
        const deps = fakeDeps({
            'https://acme.com/': redirect('https://acme.com/'),
        });

        await expect(fetchPublic('https://acme.com/', deps)).rejects.toThrow(
            'redirects more than',
        );
    });

    it('cuts the body at the size cap', async () => {
        const deps = fakeDeps({
            'https://acme.com/': page('x'.repeat(maxBytes + 1000)),
        });

        const result = await fetchPublic('https://acme.com/', deps);

        expect(result.body).toHaveLength(maxBytes);
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

function redirect(location: string) {
    return new Response(null, { status: 302, headers: { location } });
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

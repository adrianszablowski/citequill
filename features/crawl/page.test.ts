import { describe, expect, it } from 'vitest';

import type { FetchDeps } from '@/features/crawl/fetch';
import { fetchPage } from '@/features/crawl/page';

const html = `<!doctype html>
<html lang="en">
<head><title>Trackist</title></head>
<body>
<main>
<h1>You lift. Trackist does the math.</h1>
<p>Month one is easy. Month three is the test.</p>
</main>
</body>
</html>`;

const markdown = '# Trackist\n\n- Logs sets and reps\n- Computes progression';

describe('fetchPage', () => {
    it('reads the HTML for readers and the markdown version for facts when the page offers one', async () => {
        const deps = fakeDeps({
            'https://trackist.me/': page(html, {
                link: '</index.md>; rel="alternate"; type="text/markdown"',
            }),
            'https://trackist.me/index.md': new Response(markdown, {
                headers: { 'content-type': 'text/markdown' },
            }),
        });

        const result = await fetchPage('https://trackist.me/', [], deps);

        expect(result.title).toBe('Trackist');
        expect(result.body).toBe(markdown);

        expect(result.readerBody).toContain(
            '# You lift. Trackist does the math.',
        );

        expect(result.readerBody).toContain('Month three is the test.');
        expect(result.error).toBeNull();
    });

    it('keeps the HTML text as the body when there is no markdown version', async () => {
        const deps = fakeDeps({ 'https://trackist.me/': page(html) });

        const result = await fetchPage('https://trackist.me/', [], deps);

        expect(result.body).toContain('# You lift. Trackist does the math.');
        expect(result.readerBody).toBeNull();
    });

    it('falls back to the HTML text when the markdown version does not answer', async () => {
        const deps = fakeDeps({
            'https://trackist.me/': page(html, {
                link: '</index.md>; rel="alternate"; type="text/markdown"',
            }),
        });

        const result = await fetchPage('https://trackist.me/', [], deps);

        expect(result.body).toContain('# You lift. Trackist does the math.');
        expect(result.readerBody).toBeNull();
        expect(result.error).toBeNull();
    });

    it('records an error and an empty body for a failed fetch or a page that is not HTML', async () => {
        const deps = fakeDeps({
            'https://trackist.me/missing': new Response('', { status: 404 }),
            'https://trackist.me/file.pdf': new Response('%PDF', {
                headers: { 'content-type': 'application/pdf' },
            }),
        });

        expect(
            await fetchPage('https://trackist.me/missing', [], deps),
        ).toMatchObject({ body: '', readerBody: null, error: 'HTTP 404' });

        expect(
            await fetchPage('https://trackist.me/file.pdf', [], deps),
        ).toMatchObject({ body: '', error: 'Not an HTML page.' });

        expect(
            await fetchPage('https://trackist.me/unknown', [], deps),
        ).toMatchObject({
            body: '',
            error: 'No response for https://trackist.me/unknown',
        });
    });
});

function page(body: string, headers: Record<string, string> = {}) {
    return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/html', ...headers },
    });
}

function fakeDeps(responses: Record<string, Response>): FetchDeps {
    return {
        fetch: async (input) => {
            const response = responses[String(input)];

            if (!response) {
                throw new Error(`No response for ${String(input)}`);
            }

            return response;
        },
        lookup: async () => ['93.184.216.34'],
    };
}

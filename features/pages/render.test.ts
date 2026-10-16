import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '@/features/pages/render';

describe('renderMarkdown', () => {
    it('gives every heading an id a link can point to', async () => {
        const html = await renderMarkdown('## How much protein?\n\nSome.');

        expect(html).toContain(
            '<h2 id="how-much-protein">How much protein?</h2>',
        );
    });

    it('keeps tables, because a comparison lives in one', async () => {
        const html = await renderMarkdown(
            '| Plan | Price |\n| --- | --- |\n| Pro | $5 |',
        );

        expect(html).toContain('<table>');
        expect(html).toContain('<td>$5</td>');
    });

    it('keeps links to the web and to the site', async () => {
        const html = await renderMarkdown(
            '[A study](https://example.org/study) and [pricing](/pricing).',
        );

        expect(html).toContain(
            '<a href="https://example.org/study">A study</a>',
        );

        expect(html).toContain('<a href="/pricing">pricing</a>');
    });

    it('drops a link or image with a script address, because the HTML is shown as is', async () => {
        const html = await renderMarkdown(
            '[x](javascript:alert(1))\n\n![y](javascript:alert(2))',
        );

        expect(html).not.toContain('javascript:');
        expect(html).toContain('<a>x</a>');
    });

    it('drops raw HTML, because the HTML goes to the customer site', async () => {
        const html = await renderMarkdown('Hi <script>alert(1)</script> there');

        expect(html).not.toContain('<script>');
        expect(html).toContain('Hi');
    });

    it('renders nothing for an empty page', async () => {
        expect(await renderMarkdown('')).toBe('');
    });
});

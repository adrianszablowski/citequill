import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '@/features/pages/render';

describe('renderMarkdown', () => {
    it('gives every heading an id a link can point to', () => {
        const html = renderMarkdown('## How much protein?\n\nSome.');

        expect(html).toContain(
            '<h2 id="how-much-protein">How much protein?</h2>',
        );
    });

    it('keeps tables, because a comparison lives in one', () => {
        const html = renderMarkdown(
            '| Plan | Price |\n| --- | --- |\n| Pro | $5 |',
        );

        expect(html).toContain('<table>');
        expect(html).toContain('<td>$5</td>');
    });

    it('keeps links to the web and to the site', () => {
        const html = renderMarkdown(
            '[A study](https://example.org/study) and [pricing](/pricing).',
        );

        expect(html).toContain(
            '<a href="https://example.org/study">A study</a>',
        );

        expect(html).toContain('<a href="/pricing">pricing</a>');
    });

    it('drops a link or image with a script address, because the HTML is shown as is', () => {
        const html = renderMarkdown(
            '[x](javascript:alert(1))\n\n![y](javascript:alert(2))',
        );

        expect(html).not.toContain('javascript:');
        expect(html).toContain('<a>x</a>');
    });

    it('drops raw HTML, because the HTML goes to the customer site', () => {
        const html = renderMarkdown('Hi <script>alert(1)</script> there');

        expect(html).not.toContain('<script>');
        expect(html).toContain('Hi');
    });

    it('renders nothing for an empty page', () => {
        expect(renderMarkdown('')).toBe('');
    });
});

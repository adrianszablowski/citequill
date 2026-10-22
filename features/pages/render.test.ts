import { describe, expect, it } from 'vitest';

import { renderMarkdown } from '@/features/pages/render';

function html(markdown: string, locale = 'en') {
    return renderMarkdown(markdown, locale).html;
}

const footnoted = 'Protein matters.[^1]\n\n[^1]: A study from 2024.';

describe('renderMarkdown', () => {
    it('gives every heading an id a link can point to, with no prefix', () => {
        expect(html('## How much protein?\n\nSome.')).toContain(
            '<h2 id="how-much-protein">How much protein?</h2>',
        );
    });

    it("keeps the letters of the page's language in a heading id", () => {
        expect(html('## Ile białka dziennie?', 'pl')).toContain(
            '<h2 id="ile-białka-dziennie">Ile białka dziennie?</h2>',
        );
    });

    it('turns a # heading into an h2, because the title is the H1', () => {
        const rendered = html('# Deload week\n\n### Why');

        expect(rendered).not.toContain('<h1');
        expect(rendered).toContain('<h2 id="deload-week">Deload week</h2>');
        expect(rendered).toContain('<h3 id="why">Why</h3>');
    });

    it('keeps tables, because a comparison lives in one', () => {
        const rendered = html('| Plan | Price |\n| --- | --- |\n| Pro | $5 |');

        expect(rendered).toContain('<table>');
        expect(rendered).toContain('<td>$5</td>');
    });

    it('keeps links to the web, to the site, to a heading, to mail and to a phone', () => {
        const rendered = html(
            '[A study](https://example.org/study), [pricing](/pricing), [below](#why), [mail](mailto:hi@acme.com) and [call](tel:+48123456789).',
        );

        expect(rendered).toContain(
            '<a href="https://example.org/study">A study</a>',
        );

        expect(rendered).toContain('<a href="/pricing">pricing</a>');
        expect(rendered).toContain('<a href="#why">below</a>');
        expect(rendered).toContain('<a href="mailto:hi@acme.com">mail</a>');
        expect(rendered).toContain('<a href="tel:+48123456789">call</a>');
    });

    it('drops a link with a scheme outside the allow list, because the HTML is shown as is', () => {
        const rendered = html(
            '[x](javascript:alert(1)) and [chat](xmpp:hi@acme.com)',
        );

        expect(rendered).not.toContain('javascript:');
        expect(rendered).not.toContain('xmpp:');
        expect(rendered).toContain('<a>x</a>');
    });

    it('drops raw HTML, because the HTML goes to the customer site', () => {
        const rendered = html(
            'Hi <script>alert(1)</script> there\n\n<div style="color:red">Block</div>',
        );

        expect(rendered).not.toContain('<script>');
        expect(rendered).not.toContain('<div');
        expect(rendered).not.toContain('style');
        expect(rendered).toContain('Hi');
    });

    it('keeps the language class on a code block and no other class', () => {
        const rendered = html(
            '```ts\nconst a = 1;\n```\n\n- [x] done\n\n' + footnoted,
        );

        expect(rendered).toContain('<code class="language-ts">');
        expect(rendered.match(/class="/g)).toHaveLength(1);
        expect(rendered).not.toContain('<input');
    });

    it('drops an image, because the contract lists none', () => {
        const rendered = html('![A chart](https://example.org/chart.png)');

        expect(rendered).not.toContain('<img');
        expect(rendered).not.toContain('chart.png');
    });

    it('drops data: and vbscript: links', () => {
        const rendered = html(
            '[a](data:text/html,<b>x</b>) and [b](vbscript:msgbox(1))',
        );

        expect(rendered).not.toContain('data:');
        expect(rendered).not.toContain('vbscript:');
    });

    it('drops an iframe, an event handler and an SVG written as raw HTML', () => {
        const rendered = html(
            '<iframe src="https://evil.com"></iframe>\n\n<img src=x onerror="alert(1)">\n\n<svg><script>alert(1)</script></svg>',
        );

        expect(rendered).not.toContain('<iframe');
        expect(rendered).not.toContain('onerror');
        expect(rendered).not.toContain('<svg');
        expect(rendered).not.toContain('<script');
    });

    it('puts no rel and no target on a link', () => {
        const rendered = html('[A study](https://example.org/study)');

        expect(rendered).not.toContain('rel=');
        expect(rendered).not.toContain('target=');
    });

    it("writes the footnotes heading and back links in the page's language, with no class", () => {
        const rendered = html(footnoted, 'pl-PL');

        expect(rendered).toContain(
            '<h2 id="user-content-footnote-label">Przypisy</h2>',
        );

        expect(rendered).toContain(
            'aria-describedby="user-content-footnote-label"',
        );

        expect(rendered).toContain('aria-label="Wróć do odwołania 1"');
        expect(rendered).not.toContain('sr-only');
        expect(rendered).not.toContain('class=');
    });

    it('writes the footnotes in English for a language outside the table', () => {
        const rendered = html(footnoted, 'ja');

        expect(rendered).toContain(
            '<h2 id="user-content-footnote-label">Footnotes</h2>',
        );

        expect(rendered).toContain('aria-label="Back to reference 1"');
    });

    it("gives the footnotes heading an id no heading of the page's own can take", () => {
        const rendered = html(`## Footnote label\n\n${footnoted}`);

        expect(rendered).toContain(
            '<h2 id="footnote-label">Footnote label</h2>',
        );

        expect(rendered).toContain(
            '<h2 id="user-content-footnote-label">Footnotes</h2>',
        );
    });

    it('writes the footnotes in Norwegian for no as for nb, and in English for a locale named after an object key', () => {
        expect(html(footnoted, 'no')).toContain('Fotnoter');
        expect(html(footnoted, 'constructor')).toContain('Footnotes');
    });

    it('lists the headings of the body for a table of contents, without the footnotes heading', () => {
        const { toc } = renderMarkdown(
            `# Start\n\n## Ile *białka*?\n\n#### Deep\n\n${footnoted}`,
            'pl',
        );

        expect(toc).toEqual([
            { id: 'start', text: 'Start', level: 2 },
            { id: 'ile-białka', text: 'Ile białka?', level: 2 },
            { id: 'deep', text: 'Deep', level: 4 },
        ]);
    });

    it('counts the words a reader reads, without markdown signs or links', () => {
        const { wordCount } = renderMarkdown(
            '## Two words\n\nThree **more** [words](https://example.org/a-long-path).\n\n- one',
            'en',
        );

        expect(wordCount).toBe(6);
    });

    it('renders nothing for an empty page', () => {
        expect(renderMarkdown('', 'en')).toEqual({
            html: '',
            toc: [],
            wordCount: 0,
        });
    });
});

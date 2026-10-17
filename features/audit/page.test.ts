import { describe, expect, it } from 'vitest';

import { readAuditPage } from '@/features/audit/page';

const html = `<!doctype html>
<html lang="en-GB">
<head>
<title>Pricing</title>
<meta name="Robots" content="noindex">
<meta name="googlebot" content="nosnippet">
<link rel="canonical" href="/pricing#top">
<link rel="alternate" hreflang="de" href="https://acme.de/preise">
</head>
<body>
<header><a href="/">Home</a></header>
<main><h1>Plans</h1><p>Two plans.</p><a href="/contact#form">Contact</a><a href="/contact">Again</a></main>
<a href="https://other.com/">Partner</a>
<a href="javascript:void(0)">Menu</a>
</body>
</html>`;

describe('readAuditPage', () => {
    it('reads the head, the alternates and every http link of a page', () => {
        const page = readAuditPage(html, 'https://acme.com/pricing');

        expect(page).toMatchObject({
            title: 'Pricing',
            lang: 'en-gb',
            canonical: 'https://acme.com/pricing',
            robotsMeta: ['noindex', 'nosnippet'],
            alternates: [{ lang: 'de', href: 'https://acme.de/preise' }],
            links: [
                'https://acme.com/',
                'https://acme.com/contact',
                'https://other.com/',
            ],
        });
    });

    it('hashes the main text, so two pages with the same content share a hash whatever their chrome', () => {
        const one = readAuditPage(html, 'https://acme.com/pricing');

        const other = readAuditPage(
            html.replace(
                '<header><a href="/">Home</a></header>',
                '<nav>Other</nav>',
            ),
            'https://acme.com/pricing-copy',
        );

        const changed = readAuditPage(
            html.replace('Two plans.', 'Three plans.'),
            'https://acme.com/pricing',
        );

        expect(one.bodyHash).toMatch(/^[0-9a-f]{64}$/);
        expect(other.bodyHash).toBe(one.bodyHash);
        expect(changed.bodyHash).not.toBe(one.bodyHash);
    });

    it('has no hash and no words for a page with no text', () => {
        const page = readAuditPage(
            '<html><body><div id="root"></div></body></html>',
            'https://acme.com/',
        );

        expect(page.bodyHash).toBeNull();
        expect(page.wordCount).toBe(0);
    });

    it('keeps every canonical tag as written, where it sits and what it looks like', () => {
        const page = readAuditPage(
            `<html><head><link rel="canonical" href="/a"></head><body><p>Text</p><link rel="canonical" class="seo" href="https://acme.com/b"></body></html>`,
            'https://acme.com/a',
        );

        expect(page.canonical).toBe('https://acme.com/a');

        expect(page.canonicals).toEqual([
            {
                href: '/a',
                isInHead: true,
                selector: 'link',
                snippet: '<link rel="canonical" href="/a">',
            },
            {
                href: 'https://acme.com/b',
                isInHead: false,
                selector: 'link.seo',
                snippet:
                    '<link rel="canonical" class="seo" href="https://acme.com/b">',
            },
        ]);
    });

    it('reads a meta refresh and counts the words of the main text', () => {
        const page = readAuditPage(
            '<html><head><meta http-equiv="Refresh" content="0; url=/new"></head><body><nav>Menu items here</nav><main>One two  three\nfour</main></body></html>',
            'https://acme.com/old',
        );

        expect(page.refresh).toBe('0; url=/new');
        expect(page.wordCount).toBe(4);

        expect(
            readAuditPage(html, 'https://acme.com/pricing').refresh,
        ).toBeNull();
    });
});

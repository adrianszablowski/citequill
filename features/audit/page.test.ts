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

    it('has no hash for a page with no text', () => {
        expect(
            readAuditPage(
                '<html><body><div id="root"></div></body></html>',
                'https://acme.com/',
            ).bodyHash,
        ).toBeNull();
    });
});

import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import {
    footerChars,
    jsonLdChars,
    readSignals,
} from '@/features/crawl/signals';

const html = `<html><head>
<meta name="description" content=" Invoices in a minute. ">
<meta property="og:site_name" content="Acme Inc">
<meta property="og:title" content="Acme">
<link rel="canonical" href="https://acme.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"Organization","name":"Acme sp. z o.o.","foundingDate":"2019","sameAs":["https://x.com/acme"]},
 {"@type":"BreadcrumbList","itemListElement":[]},
 {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is there a trial?","acceptedAnswer":{"@type":"Answer","text":"Yes, 14 days."}}]}
]}</script>
<script type="application/ld+json">not json</script>
</head><body>
<main><a href="mailto:hi@acme.com?subject=Hi">Mail</a><a href="tel:+48123456789">Call</a></main>
<footer><a href="https://www.linkedin.com/company/acme">LinkedIn</a><a href="https://x.com/acme">X</a><a href="https://acme.com/about">About</a>
<p>Acme sp. z o.o., ul. Prosta 1, 00-001 Warszawa, NIP 123</p></footer>
</body></html>`;

describe('readSignals', () => {
    const signals = readSignals(
        cheerio.load(html),
        new URL('https://acme.com/'),
    );

    it('reads the description, the Open Graph tags and the canonical URL', () => {
        expect(signals.description).toBe('Invoices in a minute.');
        expect(signals.ogTitle).toBe('Acme');
        expect(signals.ogDescription).toBeNull();
        expect(signals.canonical).toBe('https://acme.com/');
    });

    it('prefers the organisation name from JSON-LD over og:site_name', () => {
        expect(signals.siteName).toBe('Acme sp. z o.o.');
    });

    it('keeps the JSON-LD nodes about the organisation and the questions, flattened out of @graph', () => {
        expect(signals.jsonLd).toHaveLength(2);

        expect(
            signals.jsonLd.map(
                (node) => (node as { '@type': string })['@type'],
            ),
        ).toEqual(['Organization', 'FAQPage']);
    });

    it('collects emails, phones and social profiles', () => {
        expect(signals.emails).toEqual(['hi@acme.com']);
        expect(signals.phones).toEqual(['+48123456789']);

        expect(signals.socialLinks).toEqual([
            'https://www.linkedin.com/company/acme',
            'https://x.com/acme',
        ]);
    });

    it('keeps the footer text in one line', () => {
        expect(signals.footer).toBe(
            'LinkedInXAbout Acme sp. z o.o., ul. Prosta 1, 00-001 Warszawa, NIP 123',
        );
    });

    it('caps the footer and the JSON-LD', () => {
        const long = `<html><body><footer>${'a'.repeat(footerChars + 10)}</footer><script type="application/ld+json">{"@type":"Product","name":"${'b'.repeat(jsonLdChars)}"}</script></body></html>`;

        const capped = readSignals(
            cheerio.load(long),
            new URL('https://acme.com/'),
        );

        expect(capped.footer).toHaveLength(footerChars);
        expect(capped.jsonLd).toEqual([]);
    });

    it('is empty for a page without signals', () => {
        expect(
            readSignals(
                cheerio.load('<html></html>'),
                new URL('https://acme.com/'),
            ),
        ).toEqual({
            description: null,
            siteName: null,
            ogTitle: null,
            ogDescription: null,
            canonical: null,
            jsonLd: [],
            emails: [],
            phones: [],
            socialLinks: [],
            footer: '',
        });
    });
});

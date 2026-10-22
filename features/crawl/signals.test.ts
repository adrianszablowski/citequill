import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import {
    footerChars,
    jsonLdBlocks,
    jsonLdChars,
    jsonLdNodes,
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
            logo: null,
            headerLogo: null,
            sameAs: [],
            footer: '',
        });
    });

    it("reads the organization's profiles from its sameAs, as absolute addresses", () => {
        expect(signals.sameAs).toEqual(['https://x.com/acme']);
    });

    it("reads the organization's logo from JSON-LD, as a URL or an ImageObject", () => {
        for (const logo of [
            '"/img/logo.png"',
            '{"@type":"ImageObject","url":"https://acme.com/img/logo.png","width":600}',
            '{"@type":"ImageObject","contentUrl":"/img/logo.png"}',
            '["/img/logo.png","/img/other.png"]',
        ]) {
            expect(
                signalsOf(
                    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Corporation","name":"Acme","logo":${logo}}</script><header><img src="/header.png" alt="Acme logo"></header>`,
                ).logo,
                logo,
            ).toBe('https://acme.com/img/logo.png');
        }
    });

    it("reads the header's image whose address, alternative text or class holds logo, beside the JSON-LD logo", () => {
        for (const image of [
            '<img src="/brand/logo-dark.svg">',
            '<img src="/brand/a.svg" alt="Acme Logo">',
            '<img src="/brand/a.svg" class="site-logo">',
        ]) {
            const read = signalsOf(
                `<header><img src="/hero.png" alt="A team">${image}</header>`,
            );

            expect(read.headerLogo, image).toMatch(
                /^https:\/\/acme\.com\/brand\//,
            );

            expect(read.logo).toBeNull();
        }

        expect(
            signalsOf('<main><img src="/logo.png" alt="Logo"></main>')
                .headerLogo,
        ).toBeNull();
    });

    it("prefers the header's image inside a link to the home page, and reads the first header alone", () => {
        expect(
            signalsOf(
                '<header><img src="/clients/logo-nike.png"><a href="/"><img src="/brand/acme.svg"></a></header>',
            ).headerLogo,
        ).toBe('https://acme.com/brand/acme.svg');

        expect(
            signalsOf(
                '<header><a href="/"><img src="/brand/acme.svg"></a></header><section><header><img src="/clients/logo-nike.png"></header></section>',
            ).headerLogo,
        ).toBe('https://acme.com/brand/acme.svg');

        expect(
            signalsOf(
                '<header><nav>Menu</nav></header><section><header><img src="/clients/logo-nike.png"></header></section>',
            ).headerLogo,
        ).toBeNull();
    });

    it('reads social links as full addresses and leaves out share and intent links', () => {
        expect(
            signalsOf(
                [
                    '<a href="//twitter.com/acme">Twitter</a>',
                    '<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>',
                    '<a href="https://twitter.com/intent/tweet?text=x">Tweet</a>',
                    '<a href="https://www.linkedin.com/shareArticle?url=x">Share</a>',
                    '<a href="https://www.facebook.com/acme">Facebook</a>',
                ].join(''),
            ).socialLinks,
        ).toEqual([
            'https://twitter.com/acme',
            'https://www.facebook.com/acme',
        ]);
    });

    it('reads the logo, the name and the profiles of an Organization subtype', () => {
        const read = signalsOf(
            '<script type="application/ld+json">{"@context":"https://schema.org","@type":"ProfessionalService","name":"Acme Studio","logo":"/logo.png","sameAs":"https://x.com/acme"}</script>',
        );

        expect(read).toMatchObject({
            siteName: 'Acme Studio',
            logo: 'https://acme.com/logo.png',
            sameAs: ['https://x.com/acme'],
        });

        expect(read.jsonLd).toHaveLength(1);
    });

    it('reads the Organization a WebSite names as its publisher, and a logo given by its @id', () => {
        const read = signalsOf(
            `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
                {"@type":"WebSite","publisher":{"@type":"Organization","name":"Acme","logo":{"@id":"https://acme.com/#logo"},"sameAs":["https://x.com/acme"]}},
                {"@type":"ImageObject","@id":"https://acme.com/#logo","url":"https://acme.com/logo.png"}
            ]}</script>`,
        );

        expect(read).toMatchObject({
            logo: 'https://acme.com/logo.png',
            sameAs: ['https://x.com/acme'],
        });
    });

    it('reads the profiles from the Organization the logo comes from', () => {
        const read = signalsOf(
            `<script type="application/ld+json">[
                {"@context":"https://schema.org","@type":"Organization","name":"Partner","sameAs":["https://x.com/partner"]},
                {"@context":"https://schema.org","@type":"Organization","name":"Acme","logo":"/logo.png","sameAs":["https://x.com/acme"]}
            ]</script>`,
        );

        expect(read).toMatchObject({
            logo: 'https://acme.com/logo.png',
            sameAs: ['https://x.com/acme'],
        });
    });
});

function signalsOf(body: string) {
    return readSignals(
        cheerio.load(`<html><body>${body}</body></html>`),
        new URL('https://acme.com/'),
    );
}

describe('jsonLdBlocks', () => {
    it('gives every JSON-LD script with its element and either its value or the reason it does not parse', () => {
        const blocks = jsonLdBlocks(cheerio.load(html));

        expect(blocks).toHaveLength(2);
        expect(blocks[0]).toMatchObject({ error: null });
        expect(blocks[0].value).toHaveProperty('@graph');
        expect(blocks[1]).toMatchObject({ value: null });
        expect(blocks[1].error).toEqual(expect.any(String));

        expect(blocks.map(({ element }) => element.name)).toEqual([
            'script',
            'script',
        ]);
    });

    it('holds no blank block, and leaves the crawl’s nodes as they were', () => {
        const $ = cheerio.load(
            html.replace(
                '</head>',
                '<script type="application/ld+json">\n  </script></head>',
            ),
        );

        expect(jsonLdBlocks($)).toHaveLength(2);
        expect(jsonLdNodes($)).toEqual(jsonLdNodes(cheerio.load(html)));
    });
});

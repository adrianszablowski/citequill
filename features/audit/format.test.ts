import { describe, expect, it } from 'vitest';

import { findingsPerPage } from '@/features/audit/finding';
import {
    altAsShown,
    ancestorAsShown,
    cdnTestLine,
    changesLine,
    detailLines,
    formatDuration,
    shellSentence,
    startedAgo,
} from '@/features/audit/format';

describe('formatDuration', () => {
    it('reads in seconds, minutes, or hours and minutes', () => {
        expect(formatDuration(42)).toBe('42 s');
        expect(formatDuration(750)).toBe('13 min');
        expect(formatDuration(3_600 * 2 + 60 * 5)).toBe('2 h 5 min');
    });
});

describe('startedAgo', () => {
    it('counts whole minutes since the start', () => {
        const start = '2026-10-17T10:00:00Z';
        const at = (minutes: number) => Date.parse(start) + minutes * 60_000;

        expect(startedAgo(start, at(0.5))).toBe(
            'Started less than a minute ago.',
        );

        expect(startedAgo(start, at(1))).toBe('Started a minute ago.');
        expect(startedAgo(start, at(12.9))).toBe('Started 12 minutes ago.');
    });
});

describe('changesLine', () => {
    it('says the score difference, the date of the previous audit, and the findings fixed and new', () => {
        expect(
            changesLine({
                difference: 7,
                since: '2026-10-03T10:00:00Z',
                fixed: 12,
                added: 2,
            }),
        ).toBe('+7 since 3 Oct 2026, 12 findings fixed, 2 new');
    });

    it('writes a fall with its minus sign and one finding in the singular', () => {
        expect(
            changesLine({
                difference: -3,
                since: '2026-10-03T10:00:00Z',
                fixed: 1,
                added: 0,
            }),
        ).toBe('-3 since 3 Oct 2026, 1 finding fixed, 0 new');
    });

    it('says no change when the score is the same', () => {
        expect(
            changesLine({
                difference: 0,
                since: '2026-10-03T10:00:00Z',
                fixed: 0,
                added: 0,
            }),
        ).toBe('No change since 3 Oct 2026, 0 findings fixed, 0 new');
    });
});

describe('cdnTestLine', () => {
    it('says why the CDN test did not run in full, for every outcome the audit stores', () => {
        expect(cdnTestLine('browser-refused')).toBe(
            'Citequill could not test AI search agents at your CDN. A browser from Citequill’s address did not get the home page, which a firewall or a rate limit can cause.',
        );

        expect(cdnTestLine('bot-refused')).toBe(
            'Citequill could not test AI search agents at your CDN. A browser got the home page and CitequillBot did not, so the test cannot tell a rule against AI agents from a rule against every bot.',
        );

        expect(cdnTestLine('spoof-refused')).toBe(
            'Citequill could not test AI search agents at your CDN. A claimed Googlebot or Bingbot did not get the home page, so your CDN checks crawlers by their address and may let the real agents through.',
        );

        expect(cdnTestLine(null)).toBe(
            'Citequill could not finish the test of AI search agents at your CDN, so it does not count in the score.',
        );
    });

    it('says nothing when the test passed, or for a value that is no outcome', () => {
        expect(cdnTestLine('passed')).toBeNull();
        expect(cdnTestLine('refused')).toBeNull();
    });
});

describe('shellSentence', () => {
    it('says what audit.md says the card says on a site that is a shell', () => {
        expect(shellSentence).toBe(
            'Citequill read almost no text in the raw HTML of this site. Google renders JavaScript and some hosts send crawlers a prerendered copy, so the findings about the content may not hold for them.',
        );
    });
});

describe('altAsShown', () => {
    it('tells an absent, an empty and a whitespace alt apart in words', () => {
        expect(altAsShown('absent')).toBe('No alt attribute');
        expect(altAsShown('empty')).toBe('Empty alt');
        expect(altAsShown('whitespace')).toBe('Whitespace alt');
    });

    it('quotes any other alt as found', () => {
        expect(altAsShown('Acme logo')).toBe('"Acme logo"');
        expect(altAsShown('constructor')).toBe('"constructor"');
    });
});

describe('ancestorAsShown', () => {
    it('names the ancestor that decided the verdict', () => {
        expect(ancestorAsShown('link')).toBe('In a link');
        expect(ancestorAsShown('figure')).toBe('In a figure');
    });
});

describe('detailLines', () => {
    it('writes one labelled line per key the customer can act on', () => {
        expect(
            detailLines({
                missing: [
                    'strict-transport-security',
                    'content-security-policy',
                ],
                code: 'CERT_HAS_EXPIRED',
                status: 404,
            }),
        ).toEqual([
            'Missing: strict-transport-security, content-security-policy',
            'Code: CERT_HAS_EXPIRED',
            'Status: 404',
        ]);
    });

    it('shows how many lines of robots.txt Google ignores and the numbers of the first ones', () => {
        expect(
            detailLines({ count: 7, lines: ['2', '3', '4', '5', '1234'] }),
        ).toEqual(['Count: 7', 'Lines: 2, 3, 4, 5, 1234']);
    });

    it('hides the keys the audit keeps for itself and the values with nothing to show', () => {
        expect(
            detailLines({
                reason: 'no-redirect',
                hops: [{ url: 'http://acme.com/', status: 301 }],
                isNoindex: true,
                error: null,
                missing: [],
                finalUrl: 'http://acme.com/',
            }),
        ).toEqual(['Final URL: http://acme.com/']);
    });

    it('shows the agents the CDN refused with every agent’s answer, the price of each charged agent, and the Vary the markdown came with', () => {
        expect(
            detailLines({
                agents: ['PerplexityBot'],
                answers: {
                    'OAI-SearchBot': '200',
                    PerplexityBot: '403 (Cloudflare challenge)',
                    DuckAssistBot: 'no answer',
                },
            }),
        ).toEqual([
            'Agents: PerplexityBot',
            'Answers: OAI-SearchBot 200, PerplexityBot 403 (Cloudflare challenge), DuckAssistBot no answer',
        ]);

        expect(detailLines({ prices: { PerplexityBot: 'USD 0.01' } })).toEqual([
            'Prices: PerplexityBot USD 0.01',
        ]);

        expect(
            detailLines({ reason: 'vary', vary: 'accept-encoding' }),
        ).toEqual(['Vary: accept-encoding']);

        expect(detailLines({ reason: 'missing' })).toEqual([]);
    });

    it('shows both times of a slow page with the region it was read from, and the half of assets-heavy by its count alone', () => {
        expect(detailLines({ ms: [1240, 1810], region: 'fra1' })).toEqual([
            'Time (ms): 1,240, 1,810',
            'Region: fra1',
        ]);

        expect(
            detailLines({ reason: 'bytes', bytes: 2_400_000, files: 38 }),
        ).toEqual(['Bytes: 2,400,000', 'Files: 38']);
    });

    it('shows a bad hreflang entry by its code and method, a cluster by its languages and methods, a missing return link by the URL, and a one-sided set by both lists', () => {
        expect(
            detailLines({ lang: 'en-UK', reason: 'region', method: 'tags' }),
        ).toEqual(['Lang: en-UK', 'Method: tags']);

        expect(
            detailLines({
                languages: ['en', 'de'],
                methods: ['tags', 'sitemap'],
            }),
        ).toEqual(['Languages: en, de', 'Methods: tags, sitemap']);

        expect(
            detailLines({ reason: 'return', notListed: 'https://acme.com/' }),
        ).toEqual(['Not listed back: https://acme.com/']);

        expect(
            detailLines({
                reason: 'differs',
                listed: ['https://acme.com/', 'https://acme.de/'],
                listedBack: ['https://acme.de/'],
            }),
        ).toEqual([
            'This page lists: https://acme.com/, https://acme.de/',
            'The alternate lists: https://acme.de/',
        ]);
    });

    it('shows a structured data finding by its missing properties and guides, each mismatched field with its value, its declared sizes and its count, and leaves the reason out', () => {
        expect(
            detailLines({
                missing: ['offers', 'brand.name'],
                guides: [
                    'https://developers.google.com/search/docs/appearance/structured-data/merchant-listing',
                ],
            }),
        ).toEqual([
            'Missing: offers, brand.name',
            'Google’s guides: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing',
        ]);

        expect(
            detailLines({
                notInText: { name: 'Air Max 90 – Black', price: '1299.00' },
            }),
        ).toEqual(['Not in the text: name Air Max 90 – Black, price 1299.00']);

        expect(
            detailLines({ reason: 'parse', error: 'Unexpected token' }),
        ).toEqual(['Error: Unexpected token']);

        expect(
            detailLines({
                reason: 'context',
                error: 'The block names no schema.org @context.',
            }),
        ).toEqual(['Error: The block names no schema.org @context.']);

        expect(detailLines({ types: ['Prodcut'] })).toEqual(['Types: Prodcut']);
        expect(detailLines({ type: 'FAQPage' })).toEqual(['Type: FAQPage']);

        expect(
            detailLines({ declaredWidth: 200, declaredHeight: null }),
        ).toEqual(['Declared width (px): 200']);

        expect(detailLines({ properties: ['aggregateRating'] })).toEqual([
            'Properties: aggregateRating',
        ]);

        expect(detailLines({ price: 0 })).toEqual(['Price: 0']);
        expect(detailLines({ items: 1 })).toEqual(['Items: 1']);
    });

    it('shows an AI access finding by its agents, each signal with its agents, its directives and the source of a Bing directive, and leaves the reason out', () => {
        expect(
            detailLines({ agents: ['OAI-SearchBot', 'PerplexityBot'] }),
        ).toEqual(['Agents: OAI-SearchBot, PerplexityBot']);

        expect(
            detailLines({
                signals: [
                    'search=yes,ai-train=no (*)',
                    'ai-train=no,ai-input=yes,search=yes (Applebot-Extended, Google-Extended)',
                ],
            }),
        ).toEqual([
            'Signals (agents): search=yes,ai-train=no (*), ai-train=no,ai-input=yes,search=yes (Applebot-Extended, Google-Extended)',
        ]);

        expect(
            detailLines({ reason: 'directive', directives: ['nosnippet'] }),
        ).toEqual(['Directives: nosnippet']);

        expect(detailLines({ reason: 'data-nosnippet' })).toEqual([]);

        expect(detailLines({ meta: ['noarchive'], header: [] })).toEqual([
            'Meta tag: noarchive',
        ]);

        expect(
            detailLines({ meta: ['noarchive'], header: ['nocache'] }),
        ).toEqual(['Meta tag: noarchive', 'Header: nocache']);
    });

    it('shows a page-shape finding by its halves and word counts, the title and H1 as compared, the external links, the slug and the JSON-LD date', () => {
        expect(
            detailLines({
                reasons: ['h1-position', 'first-paragraph'],
                wordsBeforeH1: 120,
                mainWords: 400,
                wordsBeforeParagraph: 130,
            }),
        ).toEqual([
            'Reasons: h1-position, first-paragraph',
            'Words before the H1: 120',
            'Words in the main text: 400',
            'Words from the H1 to the first paragraph of 15 words or more: 130',
        ]);

        expect(
            detailLines({
                comparedTitle: 'running shoes |',
                comparedH1s: ['summer sale', 'our story'],
            }),
        ).toEqual([
            'Title as compared: running shoes |',
            'H1s as compared: summer sale, our story',
        ]);

        expect(detailLines({ externalLinks: 3 })).toEqual([
            'External links: 3',
        ]);

        expect(detailLines({ segment: '12345' })).toEqual([
            'Last segment of the path: 12345',
        ]);

        expect(
            detailLines({
                lastModified: null,
                modifiedTime: null,
                dateModified: '2026-01-02',
            }),
        ).toEqual(['JSON-LD dateModified: 2026-01-02']);
    });

    it('leaves out the attributes an image finding records, whose width may be a percentage', () => {
        expect(
            detailLines({
                alt: 'absent',
                ancestor: null,
                width: '100%',
                height: '50',
            }),
        ).toEqual([]);
    });

    it('spells out the counts of a nested record', () => {
        expect(
            detailLines({
                reasons: ['headings', 'words'],
                desktop: { headings: 12, words: 1840, links: 30 },
                phone: { headings: 8, words: 900, links: 30 },
            }),
        ).toEqual([
            'Reasons: headings, words',
            'Desktop: headings 12, words 1,840, links 30',
            'Phone: headings 8, words 900, links 30',
        ]);
    });

    it('counts the elements beyond the 20 listed, and says nothing when all are listed', () => {
        expect(detailLines({ total: findingsPerPage + 14 })).toEqual([
            'and 14 more',
        ]);

        expect(detailLines({ total: findingsPerPage })).toEqual([]);
    });

    it('shows nothing for a finding with no detail', () => {
        expect(detailLines(null)).toEqual([]);
        expect(detailLines(undefined)).toEqual([]);
        expect(detailLines('served')).toEqual([]);
    });
});

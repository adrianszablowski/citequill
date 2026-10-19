import { describe, expect, it } from 'vitest';

import { type Finding, findingsPerPage } from '@/features/audit/finding';
import { readAuditPage } from '@/features/audit/page';
import { siteHosts } from '@/features/audit/queue';
import { richResultUrl } from '@/features/audit/rich-results';
import { structuredDataChecks } from '@/features/audit/structured-data-checks';

const home = 'https://acme.com/';

const context = {
    homes: [home],
    hosts: siteHosts('acme.com', ['https://acme.com']),
    projectName: 'Acme',
};

function block(json: unknown, attributes = '') {
    return `<script type="application/ld+json"${attributes}>${typeof json === 'string' ? json : JSON.stringify(json)}</script>`;
}

function schema(node: Record<string, unknown>) {
    return { '@context': 'https://schema.org', ...node };
}

function checksOf(
    body: string,
    {
        url = 'https://acme.com/page',
        head = '',
        projectName = context.projectName,
    }: { url?: string; head?: string; projectName?: string } = {},
) {
    return structuredDataChecks(
        url,
        readAuditPage(
            `<html><head>${head}</head><body>${body}</body></html>`,
            url,
        ),
        { ...context, projectName },
    );
}

function only(check: Finding['check'], findings: Finding[]) {
    return findings.filter((finding) => finding.check === check);
}

function checkIds(findings: Finding[]) {
    return [...new Set(findings.map((finding) => finding.check))].sort();
}

const logo = 'https://acme.com/#/schema/logo/image/';

function yoast(url: string, trail: { name: string; item?: string }[]) {
    return block(
        {
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'WebPage',
                    '@id': url,
                    url,
                    name: 'Acme',
                    isPartOf: { '@id': 'https://acme.com/#website' },
                    breadcrumb: { '@id': `${url}#breadcrumb` },
                },
                {
                    '@type': 'BreadcrumbList',
                    '@id': `${url}#breadcrumb`,
                    itemListElement: trail.map((item, i) => ({
                        '@type': 'ListItem',
                        position: i + 1,
                        ...item,
                    })),
                },
                {
                    '@type': 'WebSite',
                    '@id': 'https://acme.com/#website',
                    url: home,
                    name: 'Acme',
                    publisher: { '@id': 'https://acme.com/#organization' },
                    potentialAction: [
                        {
                            '@type': 'SearchAction',
                            target: {
                                '@type': 'EntryPoint',
                                urlTemplate:
                                    'https://acme.com/?s={search_term_string}',
                            },
                            'query-input': {
                                '@type': 'PropertyValueSpecification',
                                valueRequired: true,
                                valueName: 'search_term_string',
                            },
                        },
                    ],
                },
                {
                    '@type': 'Organization',
                    '@id': 'https://acme.com/#organization',
                    name: 'Acme',
                    url: home,
                    logo: { '@id': logo },
                    image: { '@id': logo },
                },
                {
                    '@type': 'ImageObject',
                    '@id': logo,
                    url: 'https://acme.com/logo.png',
                    contentUrl: 'https://acme.com/logo.png',
                    width: 512,
                    height: 512,
                },
            ],
        },
        ' class="yoast-schema-graph"',
    );
}

const post = 'https://acme.com/blog/hello/';

const article = block({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Article',
            '@id': `${post}#article`,
            headline: 'Hello &amp; welcome',
            author: { '@id': 'https://acme.com/#/schema/person/1' },
            datePublished: '2026-10-01T10:00:00+00:00',
            dateModified: '2026-10-02T10:00:00+00:00',
            image: { '@id': `${post}#primaryimage` },
            publisher: { '@id': 'https://acme.com/#organization' },
        },
        {
            '@type': 'Person',
            '@id': 'https://acme.com/#/schema/person/1',
            name: 'Ola Nowak',
            url: 'https://acme.com/author/ola/',
        },
        {
            '@type': 'ImageObject',
            '@id': `${post}#primaryimage`,
            url: 'https://acme.com/hello.jpg',
            width: 1200,
            height: 675,
        },
    ],
});

const productPage = 'https://acme.com/produkt/air-max-90/';

function product(offers: unknown) {
    return block(
        schema({
            '@type': 'Product',
            '@id': `${productPage}#product`,
            name: 'Air Max 90 &#8211; Black',
            url: productPage,
            description: 'A running shoe.',
            image: 'https://acme.com/wp-content/uploads/air-max.jpg',
            sku: 'AM90',
            offers,
        }),
    );
}

const offer = {
    '@type': 'Offer',
    price: '1299.00',
    priceValidUntil: '2027-12-31',
    priceSpecification: {
        price: '1299.00',
        priceCurrency: 'PLN',
        valueAddedTaxIncluded: 'false',
    },
    priceCurrency: 'PLN',
    availability: 'http://schema.org/InStock',
    url: productPage,
    seller: { '@type': 'Organization', name: 'Acme', url: 'https://acme.com' },
};

const productText = '<h1>Air Max 90 Black</h1><p>1&nbsp;299,00&nbsp;zł</p>';

describe('structuredDataChecks', () => {
    it('finds nothing on a page with no JSON-LD, microdata or RDFa', () => {
        expect(checksOf('<p>Text</p>')).toEqual([]);
    });

    it('hints at JSON-LD on a page with microdata or RDFa and no JSON-LD block, and not on a page with both', () => {
        for (const markup of [
            '<div itemscope itemtype="https://schema.org/Product"></div>',
            '<div vocab="https://schema.org/" typeof="Product"></div>',
        ]) {
            expect(checksOf(markup)).toEqual([
                {
                    check: 'structured-data-format',
                    url: 'https://acme.com/page',
                    detail: { reason: 'markup' },
                },
            ]);
        }

        expect(
            only(
                'structured-data-format',
                checksOf(
                    `<div itemscope></div>${block(schema({ '@type': 'Thing' }))}`,
                ),
            ),
        ).toEqual([]);
    });

    it('reads a Yoast graph on the home page: no hint at its search box, no short breadcrumb, no small logo, and a one-item trail lacks no item', () => {
        const findings = checksOf(yoast(home, [{ name: 'Home' }]), {
            url: home,
        });

        expect(only('jsonld-dropped-feature', findings)).toEqual([]);
        expect(only('breadcrumb-short', findings)).toEqual([]);
        expect(only('jsonld-logo-small', findings)).toEqual([]);
        expect(only('jsonld-invalid', findings)).toEqual([]);
        expect(only('jsonld-unknown-type', findings)).toEqual([]);
        expect(only('jsonld-self-review', findings)).toEqual([]);
        expect(only('jsonld-required-missing', findings)).toEqual([]);
    });

    it('asks every item of a breadcrumb trail but the last for its item', () => {
        const missing = (trail: { name: string; item?: string }[]) =>
            only(
                'jsonld-required-missing',
                checksOf(yoast(post, trail), { url: post }),
            ).map(({ subject, detail }) => [subject, detail]);

        expect(
            missing([
                { name: 'Home', item: home },
                { name: 'Blog' },
                { name: 'Hello' },
            ]),
        ).toEqual([]);

        expect(missing([{ name: 'Home' }, { name: 'Hello' }])).toEqual([
            [
                `${post}#breadcrumb`,
                {
                    missing: ['itemListElement.item'],
                    guides: [richResultUrl('breadcrumb')],
                },
            ],
        ]);
    });

    it('reads a Yoast article page: a two-item trail, the author and image through their references, and the headline decoded', () => {
        const findings = checksOf(
            `${yoast(post, [{ name: 'Home', item: home }, { name: 'Hello' }])}${article}<h1>Hello &amp; welcome</h1>`,
            { url: post },
        );

        expect(only('breadcrumb-short', findings)).toEqual([]);
        expect(only('jsonld-required-missing', findings)).toEqual([]);
        expect(only('jsonld-mismatch', findings)).toEqual([]);
        expect(only('jsonld-image-small', findings)).toEqual([]);

        expect(
            only('jsonld-recommended-missing', findings).map(
                ({ subject }) => subject,
            ),
        ).toEqual(['https://acme.com/#organization']);
    });

    it('reads a WooCommerce product as a merchant listing: the price found in the text, the name found without its dash', () => {
        const findings = checksOf(`${productText}${product([offer])}`, {
            url: productPage,
        });

        expect(only('jsonld-mismatch', findings)).toEqual([]);
        expect(only('jsonld-required-missing', findings)).toEqual([]);
        expect(only('merchant-price-zero', findings)).toEqual([]);

        expect(only('jsonld-recommended-missing', findings)).toMatchObject([
            {
                subject: `${productPage}#product`,
                detail: {
                    missing: expect.arrayContaining([
                        'brand.name',
                        'gtin or gtin8 or gtin12 or gtin13 or gtin14 or isbn',
                        'offers.itemCondition',
                    ]),
                    guides: [richResultUrl('merchant-listing')],
                },
            },
        ]);
    });

    it('calls a merchant listing with an AggregateOffer a zero price, and its lowPrice no missing price', () => {
        const findings = checksOf(
            `${productText}${product({
                '@type': 'AggregateOffer',
                lowPrice: '999.00',
                highPrice: '1299.00',
                offerCount: 3,
                priceCurrency: 'PLN',
                url: productPage,
            })}`,
            { url: productPage },
        );

        expect(only('merchant-price-zero', findings)).toMatchObject([
            {
                subject: `${productPage}#product`,
                detail: { type: 'AggregateOffer' },
            },
        ]);

        expect(only('jsonld-required-missing', findings)).toEqual([]);
        expect(only('jsonld-mismatch', findings)).toEqual([]);
    });

    it('calls an Offer priced 0 by a merchant listing, through its seller, a zero price, and the same product on a review site a product snippet', () => {
        const free = {
            '@type': 'Offer',
            priceSpecification: { price: 0, priceCurrency: 'PLN' },
            seller: { '@id': 'https://acme.com/#organization' },
        };

        const organization = block(
            schema({
                '@type': 'Organization',
                '@id': 'https://acme.com/#organization',
                name: 'Acme',
            }),
        );

        expect(
            only(
                'merchant-price-zero',
                checksOf(`${productText}${organization}${product(free)}`, {
                    url: productPage,
                }),
            ),
        ).toMatchObject([{ detail: { price: 0 } }]);

        const elsewhere = checksOf(
            `${productText}${product({ ...offer, url: 'https://shop.example/x', seller: { '@type': 'Organization', name: 'Shop' } })}`,
            { url: productPage },
        );

        expect(only('merchant-price-zero', elsewhere)).toEqual([]);

        expect(
            only('jsonld-recommended-missing', elsewhere)[0].detail,
        ).toMatchObject({ guides: [richResultUrl('product-snippet')] });
    });

    it('reports a name and a price the text does not hold, and a price that is not a number never', () => {
        const findings = checksOf(
            `<h1>Air Max 95</h1><p>999 zł</p>${product([offer, { '@type': 'Offer', price: 'call us' }])}`,
            { url: productPage },
        );

        expect(only('jsonld-mismatch', findings)).toMatchObject([
            {
                subject: `${productPage}#product`,
                detail: {
                    notInText: {
                        name: 'Air Max 90 – Black',
                        price: '1299.00',
                    },
                },
            },
        ]);
    });

    it('compares the headline of an Article subtype, the title of a JobPosting and the name of a LocalBusiness subtype, never an Organization name or a value that folds to nothing', () => {
        const findings = checksOf(
            `<h1>Other</h1>${block([
                schema({ '@type': 'TechArticle', headline: 'Setup guide' }),
                schema({ '@type': 'JobPosting', title: 'Welder' }),
                schema({ '@type': 'Restaurant', name: 'Roma' }),
                schema({ '@type': 'Organization', name: 'Acme Holdings' }),
                schema({ '@type': 'Event', name: '—' }),
            ])}`,
        );

        expect(
            only('jsonld-mismatch', findings).map(({ subject, detail }) => [
                subject,
                detail,
            ]),
        ).toEqual([
            ['TechArticle', { notInText: { headline: 'Setup guide' } }],
            ['JobPosting', { notInText: { title: 'Welder' } }],
            ['Restaurant', { notInText: { name: 'Roma' } }],
        ]);
    });

    it('calls the site’s own organization with ratings a self review, by its home URL or its name, and a business a directory lists never', () => {
        const directory = checksOf(
            block(
                schema({
                    '@type': 'ItemList',
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            item: {
                                '@type': 'Restaurant',
                                '@id': 'https://acme.com/firmy/roma/#business',
                                name: 'Pizzeria Roma',
                                url: 'https://pizzeriaroma.pl/',
                                aggregateRating: {
                                    '@type': 'AggregateRating',
                                    ratingValue: 4.6,
                                    reviewCount: 120,
                                },
                            },
                        },
                    ],
                }),
            ),
            { url: 'https://acme.com/firmy/' },
        );

        expect(only('jsonld-self-review', directory)).toEqual([]);

        const rating = {
            '@type': 'AggregateRating',
            ratingValue: 4.9,
            reviewCount: 80,
        };

        expect(
            only(
                'jsonld-self-review',
                checksOf(
                    block([
                        schema({
                            '@type': 'Organization',
                            '@id': 'https://acme.com/#organization',
                            aggregateRating: rating,
                        }),
                        schema({
                            '@type': 'Dentist',
                            name: 'Smile Studio!',
                            review: [{ '@type': 'Review' }],
                        }),
                        schema({
                            '@type': 'Corporation',
                            name: 'Acme Holdings',
                            aggregateRating: {},
                        }),
                    ]),
                    {
                        head: '<meta property="og:site_name" content="Smile studio">',
                    },
                ),
            ).map(({ subject, detail }) => [subject, detail]),
        ).toEqual([
            [
                'https://acme.com/#organization',
                { properties: ['aggregateRating'] },
            ],
            ['Dentist', { properties: ['review'] }],
        ]);
    });

    it('reads a block whose only text does not parse as one invalid block, named by its selector and snippet', () => {
        expect(checksOf(block('{"@type": "Product",}'))).toEqual([
            {
                check: 'jsonld-invalid',
                url: 'https://acme.com/page',
                selector: 'script',
                snippet:
                    '<script type="application/ld+json">{"@type": "Product",}</script>',
                detail: { reason: 'parse', error: expect.any(String) },
            },
        ]);
    });

    it('gives a block without a schema.org context one invalid finding and nothing else', () => {
        const findings = checksOf(
            block({
                '@type': 'Product',
                name: 'Not on the page',
                offers: { '@type': 'AggregateOffer', url: productPage },
            }),
        );

        expect(findings).toMatchObject([
            {
                check: 'jsonld-invalid',
                subject: 'Product',
                detail: {
                    reason: 'context',
                    error: 'The block names no schema.org @context.',
                },
            },
        ]);

        expect(findings).toHaveLength(1);
    });

    it('accepts schema.org over http or https, with or without the slash, in an array or as @vocab, and refuses another vocabulary or an item of a root array without one', () => {
        for (const context of [
            'http://schema.org',
            'https://schema.org/',
            ['https://schema.org', { '@language': 'pl' }],
            { '@vocab': 'http://schema.org/' },
        ]) {
            expect(
                only(
                    'jsonld-invalid',
                    checksOf(block({ '@context': context, '@type': 'Thing' })),
                ),
                JSON.stringify(context),
            ).toEqual([]);
        }

        expect(
            checkIds(
                checksOf(
                    block({
                        '@context': 'https://example.com/vocab',
                        '@type': 'Thing',
                    }),
                ),
            ),
        ).toEqual(['jsonld-invalid']);

        expect(
            checkIds(
                checksOf(
                    block([
                        schema({ '@type': 'Thing' }),
                        { '@type': 'Thing', '@id': '#second' },
                    ]),
                ),
            ),
        ).toEqual(['jsonld-invalid']);
    });

    it('names a type schema.org does not define, nested ones included, read without its prefixes, and leaves another vocabulary alone', () => {
        const findings = checksOf(
            block(
                schema({
                    '@type': ['Prodcut', 'https://schema.org/Thing'],
                    '@id': '#item',
                    brand: { '@type': 'Brnd', name: 'Acme' },
                    isRelatedTo: [
                        { '@type': 'schema:Product' },
                        { '@type': 'http://schema.org/Product' },
                        { '@type': 'https://example.com/Widget' },
                        { '@type': 'ex:Widget' },
                    ],
                }),
            ),
        );

        expect(
            only('jsonld-unknown-type', findings).map(({ subject, detail }) => [
                subject,
                detail,
            ]),
        ).toEqual([
            ['#item', { types: ['Prodcut'] }],
            ['Brnd', { types: ['Brnd'] }],
        ]);
    });

    it('hints at the dropped features by their names, nested ones included, and not at a Recipe, which schema.org makes a HowTo, or at a WebSite with a SearchAction', () => {
        const findings = checksOf(
            `<h1>Pierogi</h1>${block([
                schema({
                    '@type': 'WebPage',
                    mainEntity: { '@type': 'FAQPage', mainEntity: [] },
                }),
                schema({ '@type': 'HowTo', name: 'Fix a tap' }),
                schema({
                    '@type': 'WebSite',
                    potentialAction: { '@type': 'SearchAction' },
                }),
                schema({ '@type': 'Recipe', name: 'Pierogi' }),
                schema({ '@type': 'ClaimReview' }),
            ])}`,
        );

        expect(
            only('jsonld-dropped-feature', findings).map(
                ({ detail }) => detail,
            ),
        ).toEqual([
            { type: 'FAQPage' },
            { type: 'HowTo' },
            { type: 'ClaimReview' },
        ]);

        expect(
            only('jsonld-required-missing', findings).map(
                ({ subject }) => subject,
            ),
        ).toEqual(['Recipe']);
    });

    it('gives a node the feature of the nearest type, so a LocalBusiness that is also an Organization takes only the local business lists and a BlogPosting the article lists', () => {
        const findings = checksOf(
            block([
                schema({
                    '@type': ['Organization', 'LocalBusiness'],
                    '@id': '#shop',
                }),
                schema({ '@type': 'BlogPosting', '@id': '#post' }),
                schema({ '@type': 'Restaurant', '@id': '#roma' }),
            ]),
        );

        const guides = (check: Finding['check'], subject: string) =>
            only(check, findings).find((finding) => finding.subject === subject)
                ?.detail;

        expect(guides('jsonld-required-missing', '#shop')).toEqual({
            missing: ['address', 'name'],
            guides: [richResultUrl('local-business')],
        });

        expect(guides('jsonld-required-missing', '#roma')).toMatchObject({
            guides: [richResultUrl('local-business')],
        });

        expect(guides('jsonld-recommended-missing', '#post')).toEqual({
            missing: [
                'author',
                'dateModified',
                'datePublished',
                'headline',
                'image',
            ],
            guides: [richResultUrl('article')],
        });

        expect(guides('jsonld-required-missing', '#post')).toBeUndefined();
    });

    it('reports a missing one-of entry once, a nested path only when its parent is present or not listed, and nothing for a type outside the gallery', () => {
        const findings = checksOf(
            block([
                schema({
                    '@type': 'JobPosting',
                    '@id': '#job',
                    title: 'Welder',
                    description: 'Welding.',
                    datePosted: '2026-10-01',
                    hiringOrganization: { '@type': 'Organization' },
                }),
                schema({
                    '@type': 'Event',
                    '@id': '#event',
                    name: 'Fair',
                    startDate: '2026-11-01',
                }),
                schema({ '@type': 'Product', '@id': '#product', name: 'Shoe' }),
                schema({ '@type': 'Person', '@id': '#person' }),
            ]),
        );

        const missing = (subject: string) =>
            only('jsonld-required-missing', findings).find(
                (finding) => finding.subject === subject,
            )?.detail;

        expect(missing('#job')).toMatchObject({
            missing: ['jobLocation or applicantLocationRequirements'],
        });

        expect(missing('#event')).toMatchObject({ missing: ['location'] });

        expect(missing('#product')).toMatchObject({
            missing: ['review or aggregateRating or offers'],
        });

        expect(missing('#person')).toBeUndefined();
    });

    it('reads the declared size of an article image and of a top-level organization’s logo, and gives no finding for an image without one, a forum post or a publisher nested in an article', () => {
        const findings = checksOf(
            block([
                schema({
                    '@type': 'NewsArticle',
                    '@id': '#small',
                    image: {
                        '@type': 'ImageObject',
                        url: 'https://acme.com/a.jpg',
                        width: 200,
                        height: '200px',
                    },
                }),
                schema({
                    '@type': 'Article',
                    '@id': '#large',
                    image: [
                        'https://acme.com/b.jpg',
                        {
                            '@type': 'ImageObject',
                            width: '300',
                            height: 200,
                        },
                        { '@type': 'ImageObject', width: 10 },
                    ],
                }),
                schema({
                    '@type': 'Organization',
                    '@id': '#narrow',
                    logo: {
                        '@type': 'ImageObject',
                        width: { '@type': 'QuantitativeValue', value: 100 },
                    },
                }),
                schema({
                    '@type': 'Organization',
                    '@id': '#bare',
                    logo: 'https://acme.com/logo.png',
                }),
                schema({
                    '@type': 'DiscussionForumPosting',
                    '@id': '#thread',
                    image: { '@type': 'ImageObject', width: 64, height: 64 },
                    publisher: {
                        '@type': 'Organization',
                        '@id': '#publisher',
                        logo: {
                            '@type': 'ImageObject',
                            width: 600,
                            height: 60,
                        },
                    },
                }),
            ]),
        );

        expect(
            only('jsonld-image-small', findings).map(({ subject, detail }) => [
                subject,
                detail,
            ]),
        ).toEqual([['#small', { declaredWidth: 200, declaredHeight: 200 }]]);

        expect(
            only('jsonld-logo-small', findings).map(({ subject, detail }) => [
                subject,
                detail,
            ]),
        ).toEqual([['#narrow', { declaredWidth: 100, declaredHeight: null }]]);
    });

    it('calls a breadcrumb trail of fewer than two items short off the home page, one object counting as one', () => {
        const short = (itemListElement: unknown, url = 'https://acme.com/a') =>
            only(
                'breadcrumb-short',
                checksOf(
                    block(
                        schema({ '@type': 'BreadcrumbList', itemListElement }),
                    ),
                    { url },
                ),
            ).map(({ detail }) => detail);

        const item = { '@type': 'ListItem', position: 1, name: 'Home' };

        expect(short([item])).toEqual([{ items: 1 }]);
        expect(short(item)).toEqual([{ items: 1 }]);
        expect(short(undefined)).toEqual([{ items: 0 }]);
        expect(short([item, { ...item, position: 2 }])).toEqual([]);
        expect(short([item], home)).toEqual([]);
    });

    it('reads the author of a Yoast article through the top-level Person its @id names, so the author’s url is not missing', () => {
        const findings = checksOf(
            `<h1>Hello</h1>${block({
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'Article',
                        '@id': `${post}#article`,
                        headline: 'Hello',
                        author: {
                            name: 'Ola Nowak',
                            '@id': 'https://acme.com/#/schema/person/1',
                        },
                        datePublished: '2026-10-01T10:00:00+00:00',
                        dateModified: '2026-10-02T10:00:00+00:00',
                        image: 'https://acme.com/hello.jpg',
                    },
                    {
                        '@type': 'Person',
                        '@id': 'https://acme.com/#/schema/person/1',
                        name: 'Ola Nowak',
                        url: 'https://acme.com/author/ola/',
                    },
                ],
            })}`,
            { url: post },
        );

        expect(only('jsonld-recommended-missing', findings)).toEqual([]);
    });

    it('asks a top-level Review another node points to for no itemReviewed', () => {
        const findings = checksOf(
            `${productText}${block({
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'Product',
                        '@id': '#shoe',
                        name: 'Air Max 90',
                        review: { '@id': '#review' },
                    },
                    {
                        '@type': 'Review',
                        '@id': '#review',
                        author: { '@type': 'Person', name: 'Ola' },
                        reviewRating: { '@type': 'Rating', ratingValue: 5 },
                    },
                    {
                        '@type': 'Review',
                        '@id': '#loose',
                        author: { '@type': 'Person', name: 'Ola' },
                        reviewRating: { '@type': 'Rating', ratingValue: 5 },
                    },
                ],
            })}`,
        );

        expect(
            only('jsonld-required-missing', findings).map(
                ({ subject, detail }) => [subject, detail],
            ),
        ).toEqual([
            [
                '#loose',
                {
                    missing: ['itemReviewed'],
                    guides: [richResultUrl('review-snippet')],
                },
            ],
        ]);
    });

    it('compares no name of a business that describes the site, whose name may stand only in its logo', () => {
        const findings = checksOf(
            `<header><img src="/logo.png" alt="Hydro-Bud"></header><h1>Emergency plumbing</h1>${block(
                schema({
                    '@type': 'Plumber',
                    '@id': 'https://acme.com/#business',
                    name: 'Hydro-Bud',
                    url: home,
                    address: 'Prosta 1, Warszawa',
                }),
            )}`,
        );

        expect(only('jsonld-mismatch', findings)).toEqual([]);
    });

    it('does not take a business a directory home page lists, by an @id that is not an absolute URL, for the site itself', () => {
        const findings = checksOf(
            block(
                schema({
                    '@type': 'ItemList',
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            item: {
                                '@type': 'Restaurant',
                                '@id': '#roma',
                                name: 'Pizzeria Roma',
                                aggregateRating: {
                                    '@type': 'AggregateRating',
                                    ratingValue: 4.6,
                                    reviewCount: 120,
                                },
                            },
                        },
                    ],
                }),
            ),
            { url: home },
        );

        expect(only('jsonld-self-review', findings)).toEqual([]);
    });

    it('finds a Polish price after a name ending in a digit, passes a product when one of its offers is in the text, and compares no price of 0', () => {
        const priced = (text: string, offers: unknown) =>
            only(
                'jsonld-mismatch',
                checksOf(
                    `${text}${block(
                        schema({
                            '@type': 'Product',
                            name: 'Air Max 90',
                            offers,
                        }),
                    )}`,
                ),
            ).map(({ detail }) => detail);

        const at = (price: unknown) => ({ '@type': 'Offer', price });

        expect(
            priced('<h1>Air Max 90</h1>\n<p>129,00&nbsp;zł</p>', at('129.00')),
        ).toEqual([]);

        expect(
            priced('<h1>Air Max 90</h1>\n<p>149 zł</p>', [
                at('129.00'),
                at('149.00'),
            ]),
        ).toEqual([]);

        expect(
            priced('<h1>Air Max 90</h1>\n<p>99 zł</p>', [
                at('129.00'),
                at('149.00'),
            ]),
        ).toEqual([{ notInText: { price: '129.00 or 149.00' } }]);

        expect(priced('<h1>Air Max 90</h1><p>Free</p>', at(0))).toEqual([]);
    });

    it('finds the price of a minified page, its heading and its price in adjacent elements', () => {
        expect(
            only(
                'jsonld-mismatch',
                checksOf(
                    `<h1>Air Max 90</h1><p>149 zł</p>${block(
                        schema({
                            '@type': 'Product',
                            name: 'Air Max 90',
                            offers: { '@type': 'Offer', price: '149.00' },
                        }),
                    )}`,
                ),
            ),
        ).toEqual([]);
    });

    it('calls no product nested in a category page a zero price, only a top-level one', () => {
        const aggregate = {
            '@type': 'AggregateOffer',
            lowPrice: '999.00',
            priceCurrency: 'PLN',
            url: productPage,
        };

        expect(
            only(
                'merchant-price-zero',
                checksOf(
                    block(
                        schema({
                            '@type': 'ItemList',
                            itemListElement: [
                                {
                                    '@type': 'ListItem',
                                    position: 1,
                                    item: {
                                        '@type': 'Product',
                                        name: 'Air Max 90',
                                        offers: aggregate,
                                    },
                                },
                            ],
                        }),
                    ),
                ),
            ),
        ).toEqual([]);
    });

    it('reads no blank block, so a page with microdata and an empty JSON-LD script gets the format hint alone', () => {
        expect(
            checkIds(
                checksOf(
                    `<div itemscope itemtype="https://schema.org/Product"></div>${block(' ')}`,
                ),
            ),
        ).toEqual(['structured-data-format']);
    });

    it('reads an @graph item that names schema.org in its own @context, while the object holding it is one invalid finding', () => {
        const findings = checksOf(
            block({
                '@context': 'https://example.com/vocab',
                '@graph': [
                    {
                        '@context': 'https://schema.org/',
                        '@type': 'Prodcut',
                        '@id': '#item',
                    },
                ],
            }),
        );

        expect(checkIds(findings)).toEqual([
            'jsonld-invalid',
            'jsonld-unknown-type',
        ]);
    });

    it('asks a Q&A page for the text of its answers, a video for the name, start and URL of its clips, a forum post for its counter, and a job for its country', () => {
        const findings = checksOf(
            block([
                schema({
                    '@type': 'QAPage',
                    '@id': '#qa',
                    mainEntity: {
                        '@type': 'Question',
                        name: 'Which shoe?',
                        answerCount: 1,
                        acceptedAnswer: { '@type': 'Answer' },
                    },
                }),
                schema({
                    '@type': 'VideoObject',
                    '@id': '#video',
                    name: 'Lacing',
                    thumbnailUrl: 'https://acme.com/t.jpg',
                    uploadDate: '2026-10-01',
                    hasPart: { '@type': 'Clip', name: 'Knot' },
                }),
                schema({
                    '@type': 'DiscussionForumPosting',
                    '@id': '#thread',
                    author: { '@type': 'Person', name: 'Ola' },
                    datePublished: '2026-10-01',
                    text: 'Hello',
                    interactionStatistic: {
                        '@type': 'InteractionCounter',
                        userInteractionCount: 5,
                    },
                }),
                schema({
                    '@type': 'JobPosting',
                    '@id': '#job',
                    title: 'Welder',
                    description: 'Welding.',
                    datePosted: '2026-10-01',
                    hiringOrganization: { '@type': 'Organization' },
                    jobLocation: {
                        '@type': 'Place',
                        address: { '@type': 'PostalAddress' },
                    },
                }),
            ]),
        );

        expect(
            only('jsonld-required-missing', findings).map(
                ({ subject, detail }) => [
                    subject,
                    (detail as { missing: string[] }).missing,
                ],
            ),
        ).toEqual([
            ['#qa', ['mainEntity.acceptedAnswer.text']],
            ['#video', ['hasPart.startOffset', 'hasPart.url']],
            ['#thread', ['interactionStatistic.interactionType']],
            ['#job', ['jobLocation.address.addressCountry']],
        ]);
    });

    it(`keeps one finding per node and ${findingsPerPage} per check, with the total`, () => {
        const findings = only(
            'jsonld-unknown-type',
            checksOf(
                block(
                    Array.from({ length: findingsPerPage + 5 }, (_, i) =>
                        schema({ '@type': 'Widget', '@id': `#w${i}` }),
                    ),
                ),
            ),
        );

        expect(findings).toHaveLength(findingsPerPage);

        expect(findings[0].detail).toEqual({
            types: ['Widget'],
            total: findingsPerPage + 5,
        });

        expect(
            only(
                'jsonld-unknown-type',
                checksOf(
                    block([
                        schema({ '@type': 'Widget' }),
                        schema({ '@type': 'Widget' }),
                    ]),
                ),
            ),
        ).toHaveLength(1);
    });
});

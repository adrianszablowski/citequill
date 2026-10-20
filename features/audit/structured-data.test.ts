import { describe, expect, it } from 'vitest';

import { readAuditPage } from '@/features/audit/page';
import { richResults } from '@/features/audit/rich-results';
import {
    declaredSize,
    decodeMarkup,
    describesSite,
    featuresOf,
    fold,
    hasArticle,
    isA,
    isArticleNode,
    isPriceInText,
    jsonLdImages,
    modifiedDates,
    priceOf,
    structuredData,
    topNodes,
} from '@/features/audit/structured-data';

const url = 'https://acme.com/blog/hello/';

function blocksOf(...values: unknown[]) {
    return readAuditPage(
        values
            .map(
                (value) =>
                    `<script type="application/ld+json">${JSON.stringify(value)}</script>`,
            )
            .join(''),
        url,
    ).jsonLd;
}

function feature(name: string) {
    return richResults.find((result) => result.feature === name);
}

describe('topNodes', () => {
    it('reads the object a block holds, the items of a root array and the items of a @graph, which take the context of the object holding them', () => {
        const [graph, array] = blocksOf(
            {
                '@context': 'https://schema.org',
                '@graph': [{ '@type': 'WebPage' }, { '@type': 'Person' }],
            },
            [
                { '@context': 'https://schema.org', '@type': 'Thing' },
                { a: 1 },
                7,
            ],
        );

        expect(
            topNodes(graph).map(({ node, hasContext }) => [
                node['@type'] ?? null,
                hasContext,
            ]),
        ).toEqual([
            [null, true],
            ['WebPage', true],
            ['Person', true],
        ]);

        expect(topNodes(array).map(({ hasContext }) => hasContext)).toEqual([
            true,
            false,
        ]);
    });

    it('accepts an item of a @graph that names schema.org in its own @context, when the object holding it does not', () => {
        const [block] = blocksOf({
            '@graph': [
                { '@context': 'https://schema.org', '@type': 'Product' },
                { '@type': 'Thing' },
            ],
        });

        expect(
            topNodes(block).map(({ node, hasContext }) => [
                node['@type'] ?? null,
                hasContext,
            ]),
        ).toEqual([
            [null, false],
            ['Product', true],
            ['Thing', false],
        ]);

        expect(structuredData([block]).outside.map(({ node }) => node)).toEqual(
            [block.value],
        );
    });

    it('reads nothing from a block that does not parse', () => {
        const [broken] = readAuditPage(
            '<script type="application/ld+json">{</script>',
            url,
        ).jsonLd;

        expect(broken.error).toEqual(expect.any(String));
        expect(topNodes(broken)).toEqual([]);
    });
});

describe('structuredData', () => {
    const graph = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Article',
                '@id': '#article',
                author: [{ '@id': '#ola' }, { '@id': '#unknown' }],
                isPartOf: { '@id': '#page' },
                about: { '@type': 'Thing', name: '' },
            },
            {
                '@type': 'WebPage',
                '@id': '#page',
                hasPart: { '@id': '#article' },
            },
        ],
    };

    const person = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': '#ola',
        name: 'Ola',
    };

    it('reads a value that is only an @id as the node with that @id in any block, and keeps one it cannot find', () => {
        const data = structuredData(blocksOf(graph, person));
        const article = data.top[1].node;

        expect(data.valuesAt(article, 'author.name')).toEqual(['Ola']);

        expect(data.valuesAt(article, 'author')).toEqual([
            person,
            { '@id': '#unknown' },
        ]);
    });

    it('reads an object with an @id and other properties with the node of that @id, its own values winning, and prefers the top-level node, then the first with a @type', () => {
        const data = structuredData(
            blocksOf({
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'Article',
                        author: { name: 'Ola N.', '@id': '#person' },
                        editor: { '@id': '#editor', jobTitle: 'Editor' },
                        reviewedBy: {
                            '@type': 'Person',
                            '@id': '#editor',
                            name: 'Ewa',
                        },
                    },
                    {
                        '@type': 'Person',
                        '@id': '#person',
                        name: 'Ola Nowak',
                        url: 'https://acme.com/author/ola/',
                    },
                ],
            }),
        );

        const article = data.top[1].node;

        expect(data.valuesAt(article, 'author')).toEqual([
            {
                '@type': 'Person',
                '@id': '#person',
                name: 'Ola N.',
                url: 'https://acme.com/author/ola/',
            },
        ]);

        expect(data.valuesAt(article, 'editor')).toEqual([
            {
                '@type': 'Person',
                '@id': '#editor',
                name: 'Ewa',
                jobTitle: 'Editor',
            },
        ]);
    });

    it('follows references only along a path, so a graph whose nodes point at each other ends', () => {
        const data = structuredData(blocksOf(graph));
        const article = data.top[1].node;

        expect(
            data.valuesAt(article, 'isPartOf.hasPart.isPartOf.hasPart'),
        ).toEqual([article]);

        expect(data.nodes.map(({ node }) => node['@type'] ?? null)).toEqual([
            null,
            'Article',
            'Thing',
            'WebPage',
        ]);
    });

    it('counts a value as present unless it is empty, so 0 and false are present', () => {
        const [block] = blocksOf({
            '@context': 'https://schema.org',
            '@type': 'Offer',
            price: 0,
            isFamilyFriendly: false,
            name: ' ',
            sku: [],
            seller: {},
            gtin: null,
        });

        const data = structuredData([block]);
        const offer = data.top[0].node;

        expect(
            ['price', 'isFamilyFriendly', 'name', 'sku', 'seller', 'gtin'].map(
                (property) => data.valuesAt(offer, property).length > 0,
            ),
        ).toEqual([true, true, false, false, false, false]);
    });

    it('reads a top-level Review or AggregateRating another node points to as nested', () => {
        const data = structuredData(
            blocksOf({
                '@context': 'https://schema.org',
                '@graph': [
                    {
                        '@type': 'Product',
                        review: { '@id': '#review' },
                        aggregateRating: { '@id': '#rating' },
                    },
                    { '@type': 'Review', '@id': '#review' },
                    { '@type': 'AggregateRating', '@id': '#rating' },
                    { '@type': 'Review', '@id': '#other' },
                ],
            }),
        );

        expect(data.top.map(({ node }) => node['@type'] ?? null)).toEqual([
            null,
            'Product',
            'Review',
        ]);

        expect(data.top[2].node['@id']).toBe('#other');
        expect(data.nodes).toHaveLength(5);
    });

    it('reads no node of a block without a schema.org context', () => {
        expect(
            structuredData(blocksOf({ '@type': 'Product', name: 'X' })).nodes,
        ).toEqual([]);
    });
});

describe('isA', () => {
    it('follows every parent schema.org gives a type', () => {
        expect(isA('Restaurant', 'LocalBusiness')).toBe(true);
        expect(isA('Restaurant', 'Organization')).toBe(true);
        expect(isA('Restaurant', 'Place')).toBe(true);
        expect(isA('BlogPosting', 'SocialMediaPosting')).toBe(true);
        expect(isA('Recipe', 'HowTo')).toBe(true);
        expect(isA('Organization', 'LocalBusiness')).toBe(false);
        expect(isA('Prodcut', 'Product')).toBe(false);
    });
});

describe('featuresOf', () => {
    it('takes the feature of the nearest type a feature names, so a BlogPosting is an article and not a forum post', () => {
        expect(featuresOf({ '@type': 'BlogPosting' }, false)).toEqual([
            feature('article'),
        ]);

        expect(featuresOf({ '@type': 'SocialMediaPosting' }, false)).toEqual([
            feature('discussion forum'),
        ]);

        expect(
            featuresOf({ '@type': 'EmployerAggregateRating' }, false),
        ).toEqual([feature('employer rating')]);
    });

    it('drops a feature another type of the node descends from, and joins the rest', () => {
        expect(
            featuresOf({ '@type': ['Organization', 'Restaurant'] }, false),
        ).toEqual([feature('local business')]);

        expect(featuresOf({ '@type': ['Product', 'Event'] }, true)).toEqual([
            feature('merchant listing'),
            feature('event'),
        ]);
    });

    it('gives a Product the merchant listing lists when it is one, and the product snippet lists otherwise', () => {
        expect(featuresOf({ '@type': 'IndividualProduct' }, true)).toEqual([
            feature('merchant listing'),
        ]);

        expect(featuresOf({ '@type': 'Product' }, false)).toEqual([
            feature('product snippet'),
        ]);

        expect(featuresOf({ '@type': 'ProductGroup' }, true)).toEqual([
            feature('product variants'),
        ]);
    });

    it('gives a type outside the gallery, an unknown type and another vocabulary no feature', () => {
        expect(
            featuresOf({ '@type': ['Person', 'Widget', 'ex:Product'] }, false),
        ).toEqual([]);
    });
});

describe('fold', () => {
    it('decodes the markup, then keeps letters and digits in lower case after NFKC', () => {
        expect(fold(decodeMarkup('Air Max 90 &#8211; Black'))).toBe(
            fold('Air Max 90 Black'),
        );

        expect(decodeMarkup('Air Max 90 &#8211; Black')).toBe(
            'Air Max 90 – Black',
        );

        expect(fold(decodeMarkup('Caf&eacute; &amp; Bar'))).toBe('cafébar');
        expect(fold('Ｆｉｌｅ ﬁx №5')).toBe('filefixno5');
        expect(fold('— ·')).toBe('');
    });

    it('leaves a literal angle bracket of the page text alone', () => {
        expect(fold('Size <M>')).toBe('sizem');
    });
});

describe('priceOf and isPriceInText', () => {
    it('reads a JSON number or a numeric string as a price, and nothing else', () => {
        expect(priceOf(1299)).toBe(1299);
        expect(priceOf('1299.00')).toBe(1299);
        expect(priceOf(' 0 ')).toBe(0);

        for (const value of ['1299,00', '1 299', 'PLN 1299', '', null, -5]) {
            expect(priceOf(value), String(value)).toBeNull();
        }
    });

    it('finds the price in a number whose grouping marks are dropped, with two decimals or none when they are zero, and in a number after another with a space between', () => {
        for (const text of [
            'Cena: 1 299 zł',
            '1.299,00 €',
            'only 1299!',
            '1 299,00',
            '1 299',
            '1’299.00 CHF',
        ]) {
            expect(isPriceInText(1299, text), text).toBe(true);
        }

        expect(isPriceInText(129, 'Air Max 90 129,00 zł')).toBe(true);
        expect(isPriceInText(1299.5, '1 299,50 zł')).toBe(true);
        expect(isPriceInText(1299.5, '1 299 zł')).toBe(false);
        expect(isPriceInText(1299, '12 990 zł')).toBe(false);
        expect(isPriceInText(1299, '1299,99')).toBe(false);
        expect(isPriceInText(0, 'Free')).toBe(false);
    });
});

describe('describesSite', () => {
    const site = {
        url,
        homes: ['https://acme.com/', 'https://acme.com/de/'],
        hosts: ['acme.com', 'www.acme.com'],
        names: [fold('Acme'), fold('Acme Inc')],
    };

    const describes = (node: Record<string, unknown>) =>
        describesSite(node, structuredData([]), site);

    it('is the node whose absolute @id or url, resolved, without the fragment and the trailing slash, is a home page', () => {
        expect(describes({ '@id': 'https://acme.com/#organization' })).toBe(
            true,
        );

        expect(describes({ url: 'https://acme.com' })).toBe(true);
        expect(describes({ url: '/de' })).toBe(true);

        expect(
            describes({ '@id': 'https://acme.com/firmy/roma/#business' }),
        ).toBe(false);

        expect(describes({ url: 'https://www.acme.com/' })).toBe(false);

        const onHome = (node: Record<string, unknown>) =>
            describesSite(node, structuredData([]), {
                ...site,
                url: 'https://acme.com/',
            });

        expect(onHome({ '@id': '#roma' })).toBe(false);
        expect(onHome({ url: '#roma' })).toBe(true);
    });

    it('is the node whose folded name is the site name or the project name, never an empty one', () => {
        expect(describes({ name: 'ACME inc.' })).toBe(true);
        expect(describes({ name: 'Acme Holdings' })).toBe(false);
        expect(describes({ name: '—' })).toBe(false);

        expect(
            describesSite({ name: '—' }, structuredData([]), {
                ...site,
                names: [],
            }),
        ).toBe(false);
    });
});

describe('declaredSize', () => {
    it('reads a number, a numeric string with an optional px, or the value of an object', () => {
        expect(declaredSize(512)).toBe(512);
        expect(declaredSize('512')).toBe(512);
        expect(declaredSize('512px')).toBe(512);

        expect(
            declaredSize({ '@type': 'QuantitativeValue', value: '96' }),
        ).toBe(96);

        for (const value of ['wide', '512 pixels', null, [512]]) {
            expect(declaredSize(value), String(value)).toBeNull();
        }
    });
});

describe('jsonLdImages', () => {
    it('lists the image, logo and thumbnailUrl of every node read, as a URL or the url and contentUrl of an ImageObject, through references, absolute and once each', () => {
        expect(
            jsonLdImages(
                structuredData(
                    blocksOf(
                        {
                            '@context': 'https://schema.org',
                            '@graph': [
                                {
                                    '@type': 'Article',
                                    image: [{ '@id': '#primary' }, '/a.jpg'],
                                    publisher: {
                                        '@type': 'Organization',
                                        logo: 'https://cdn.other.com/logo.png#x',
                                    },
                                    video: {
                                        '@type': 'VideoObject',
                                        thumbnailUrl: 'thumb.jpg',
                                    },
                                },
                                {
                                    '@type': 'ImageObject',
                                    '@id': '#primary',
                                    url: 'https://acme.com/a.jpg',
                                    contentUrl: 'https://acme.com/a-full.jpg',
                                },
                            ],
                        },
                        { '@type': 'Article', image: '/ignored.jpg' },
                        {
                            '@context': 'https://schema.org',
                            '@type': 'Article',
                            image: [
                                'data:image/png;base64,AAAA',
                                { '@type': 'Thing', url: '/not-an-image.jpg' },
                            ],
                        },
                    ),
                ),
                url,
            ),
        ).toEqual([
            'https://acme.com/a.jpg',
            'https://acme.com/a-full.jpg',
            'https://cdn.other.com/logo.png',
            'https://acme.com/blog/hello/thumb.jpg',
        ]);
    });
});

describe('isArticleNode', () => {
    it('takes a node of the Article feature, its subtypes included, and not a forum post', () => {
        for (const type of [
            'Article',
            'NewsArticle',
            'BlogPosting',
            'TechArticle',
            ['WebPage', 'Article'],
        ]) {
            expect(isArticleNode({ '@type': type }), String(type)).toBe(true);
        }

        for (const type of ['DiscussionForumPosting', 'WebPage', 'Product']) {
            expect(isArticleNode({ '@type': type }), type).toBe(false);
        }
    });
});

describe('hasArticle', () => {
    const context = 'https://schema.org';

    function articleOf(...values: unknown[]) {
        return hasArticle(structuredData(blocksOf(...values)));
    }

    it('finds an article at the top of a block, in its @graph, as the mainEntity of a top node, and through an @id reference', () => {
        expect(articleOf({ '@context': context, '@type': 'NewsArticle' })).toBe(
            true,
        );

        expect(
            articleOf({
                '@context': context,
                '@graph': [{ '@type': 'WebPage' }, { '@type': 'BlogPosting' }],
            }),
        ).toBe(true);

        expect(
            articleOf({
                '@context': context,
                '@type': 'WebPage',
                mainEntity: { '@type': 'TechArticle', headline: 'Hello' },
            }),
        ).toBe(true);

        expect(
            articleOf(
                {
                    '@context': context,
                    '@type': 'WebPage',
                    mainEntity: { '@id': '#post' },
                },
                {
                    '@context': context,
                    '@type': 'ItemList',
                    itemListElement: [{ '@type': 'Article', '@id': '#post' }],
                },
            ),
        ).toBe(true);
    });

    it('finds no article in a blog that lists its posts, an ItemList of articles or a hasPart', () => {
        expect(
            articleOf({
                '@context': context,
                '@type': 'Blog',
                blogPost: [{ '@type': 'BlogPosting' }],
            }),
        ).toBe(false);

        expect(
            articleOf({
                '@context': context,
                '@type': 'ItemList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        item: { '@type': 'Article' },
                    },
                ],
            }),
        ).toBe(false);

        expect(
            articleOf({
                '@context': context,
                '@type': 'WebPage',
                hasPart: { '@type': 'Article' },
            }),
        ).toBe(false);
    });

    it('finds no article in a forum post or in a node without a schema.org context', () => {
        expect(
            articleOf({
                '@context': context,
                '@type': 'DiscussionForumPosting',
            }),
        ).toBe(false);

        expect(articleOf({ '@type': 'Article' })).toBe(false);

        expect(
            articleOf({
                '@context': 'https://example.com',
                '@type': 'Article',
            }),
        ).toBe(false);
    });
});

describe('modifiedDates', () => {
    it('reads every dateModified string of the parsed blocks, at any depth and under @graph, context or not', () => {
        const blocks = [
            ...blocksOf(
                {
                    '@context': 'https://schema.org',
                    '@graph': [
                        { '@type': 'WebPage', dateModified: '2026-01-02' },
                        {
                            '@type': 'FAQPage',
                            mainEntity: [
                                {
                                    '@type': 'Question',
                                    acceptedAnswer: {
                                        '@type': 'Answer',
                                        dateModified: '2026-09-30',
                                    },
                                },
                            ],
                        },
                    ],
                },
                { '@type': 'Article', dateModified: ['soon', 7] },
            ),
            ...readAuditPage(
                '<script type="application/ld+json">{"dateModified": </script>',
                url,
            ).jsonLd,
        ];

        expect(modifiedDates(blocks)).toEqual([
            '2026-01-02',
            '2026-09-30',
            'soon',
        ]);
    });
});

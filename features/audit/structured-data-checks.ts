import { cappedPerPage, type Finding } from '@/features/audit/finding';
import type { AuditPage } from '@/features/audit/page';
import type { PageCheckContext } from '@/features/audit/page-checks';
import type { SchemaOrgType } from '@/features/audit/schema-org';
import {
    declaredSize,
    decodeMarkup,
    describesSite,
    featuresOf,
    fold,
    isArticleNode,
    isDefinedType,
    isMerchantListing,
    isNode,
    isOfType,
    isPriceInText,
    type JsonNode,
    type LocatedNode,
    missingProperties,
    type OwnSite,
    priceOf,
    type StructuredData,
    typesOf,
} from '@/features/audit/structured-data';
import type { Json } from '@/lib/types/database';

export function structuredDataChecks(
    url: string,
    page: Pick<
        AuditPage,
        | 'jsonLd'
        | 'structuredData'
        | 'hasMicrodata'
        | 'siteName'
        | 'visibleText'
    >,
    {
        homes,
        hosts,
        projectName,
    }: Pick<PageCheckContext, 'homes' | 'hosts' | 'projectName'>,
): Finding[] {
    if (page.jsonLd.length === 0) {
        return page.hasMicrodata
            ? [
                  {
                      check: 'structured-data-format',
                      url,
                      detail: { reason: 'markup' },
                  },
              ]
            : [];
    }

    const data = page.structuredData;

    const site: OwnSite = {
        url,
        homes,
        hosts,
        names: [page.siteName, projectName]
            .flatMap((name) => (name ? [fold(name)] : []))
            .filter(Boolean),
    };

    const text = { raw: page.visibleText, folded: fold(page.visibleText) };

    return cappedPerPage([
        ...page.jsonLd.flatMap((block): Finding[] =>
            block.error === null
                ? []
                : [
                      {
                          check: 'jsonld-invalid',
                          url,
                          selector: block.selector,
                          snippet: block.snippet,
                          detail: { reason: 'parse', error: block.error },
                      },
                  ],
        ),
        ...data.outside.map((located) =>
            finding('jsonld-invalid', url, located, {
                reason: 'context',
                error: 'The block names no schema.org @context.',
            }),
        ),
        ...data.nodes.flatMap((located) =>
            nodeFindings(url, located, data, site),
        ),
        ...data.top.flatMap((located) =>
            topNodeFindings(url, located, data, site, text),
        ),
    ]);
}

interface PageText {
    raw: string;
    folded: string;
}

const articleImagePixels = 50_000;

const logoPixels = 112;

const droppedTypes = [
    'HowTo',
    'FAQPage',
    'SpecialAnnouncement',
    'ClaimReview',
] as const satisfies readonly SchemaOrgType[];

const mismatchNames = [
    'Product',
    'Event',
    'Recipe',
    'Course',
    'SoftwareApplication',
    'LocalBusiness',
] as const satisfies readonly SchemaOrgType[];

function isDropped(type: string) {
    return droppedTypes.some((name) => name === type);
}

function finding(
    check: Finding['check'],
    url: string,
    { node, block }: LocatedNode,
    detail?: Json,
): Finding {
    const id = node['@id'];

    return {
        check,
        url,
        subject: typeof id === 'string' ? id : (typesOf(node)[0] ?? null),
        selector: block.selector,
        snippet: block.snippet,
        ...(detail !== undefined && { detail }),
    };
}

function nodeFindings(
    url: string,
    located: LocatedNode,
    data: StructuredData,
    site: OwnSite,
): Finding[] {
    const { node } = located;
    const { valuesAt } = data;
    const types = typesOf(node);
    const findings: Finding[] = [];

    const unknown = types.filter(
        (type) => !type.includes(':') && !isDefinedType(type),
    );

    if (unknown.length > 0) {
        findings.push(
            finding('jsonld-unknown-type', url, located, { types: unknown }),
        );
    }

    const dropped = types.find(isDropped);

    if (dropped) {
        findings.push(
            finding('jsonld-dropped-feature', url, located, { type: dropped }),
        );
    }

    if (isOfType(node, 'Organization')) {
        const reviews = ['aggregateRating', 'review'].filter(
            (property) => valuesAt(node, property).length > 0,
        );

        if (reviews.length > 0 && describesSite(node, data, site)) {
            findings.push(
                finding('jsonld-self-review', url, located, {
                    properties: reviews,
                }),
            );
        }
    }

    if (isArticleNode(node)) {
        const small = imageObjects(node, 'image', data).find(
            ({ declaredWidth, declaredHeight }) =>
                declaredWidth !== null &&
                declaredHeight !== null &&
                declaredWidth * declaredHeight < articleImagePixels,
        );

        if (small) {
            findings.push(finding('jsonld-image-small', url, located, small));
        }
    }

    if (isOfType(node, 'BreadcrumbList')) {
        const items = valuesAt(node, 'itemListElement').length;

        if (items < 2 && !site.homes.includes(url)) {
            findings.push(finding('breadcrumb-short', url, located, { items }));
        }
    }

    return findings;
}

function topNodeFindings(
    url: string,
    located: LocatedNode,
    data: StructuredData,
    site: OwnSite,
    text: PageText,
): Finding[] {
    const { node } = located;

    const isListing =
        isOfType(node, 'Product') && isMerchantListing(node, data, site);

    const findings = [
        ...propertyFindings(url, located, data, isListing),
        ...mismatchFindings(url, located, data, site, text),
    ];

    if (isOfType(node, 'Organization')) {
        const logo = imageObjects(node, 'logo', data).find(
            ({ declaredWidth, declaredHeight }) =>
                [declaredWidth, declaredHeight].some(
                    (size) => size !== null && size < logoPixels,
                ),
        );

        if (logo) {
            findings.push(finding('jsonld-logo-small', url, located, logo));
        }
    }

    const zero = isListing ? zeroPrice(node, data) : null;

    if (zero) {
        findings.push(finding('merchant-price-zero', url, located, zero));
    }

    return findings;
}

function imageObjects(
    node: JsonNode,
    property: string,
    { valuesAt }: Pick<StructuredData, 'valuesAt'>,
) {
    return valuesAt(node, property)
        .filter(
            (image): image is JsonNode =>
                isNode(image) && isOfType(image, 'ImageObject'),
        )
        .map((image) => ({
            declaredWidth: declaredSize(valuesAt(image, 'width')[0]),
            declaredHeight: declaredSize(valuesAt(image, 'height')[0]),
        }));
}

function zeroPrice(
    node: JsonNode,
    { valuesAt }: Pick<StructuredData, 'valuesAt'>,
): Json {
    const offers = valuesAt(node, 'offers').filter(isNode);

    if (offers.some((offer) => isOfType(offer, 'AggregateOffer'))) {
        return { type: 'AggregateOffer' };
    }

    return offers.some(
        (offer) =>
            isOfType(offer, 'Offer') &&
            [
                ...valuesAt(offer, 'price'),
                ...valuesAt(offer, 'priceSpecification.price'),
            ].some((price) => priceOf(price) === 0),
    )
        ? { price: 0 }
        : null;
}

function propertyFindings(
    url: string,
    located: LocatedNode,
    data: StructuredData,
    isListing: boolean,
): Finding[] {
    const { node } = located;

    if (typesOf(node).some(isDropped)) {
        return [];
    }

    const features = featuresOf(node, isListing);
    const guides = [...new Set(features.map((feature) => feature.url))];

    return (
        [
            ['jsonld-required-missing', 'required'],
            ['jsonld-recommended-missing', 'recommended'],
        ] as const
    ).flatMap(([check, list]) => {
        const missing = [
            ...new Set(
                features.flatMap((feature) =>
                    missingProperties(node, feature, feature[list], data),
                ),
            ),
        ];

        return missing.length > 0
            ? [finding(check, url, located, { missing, guides })]
            : [];
    });
}

function mismatchFindings(
    url: string,
    located: LocatedNode,
    data: StructuredData,
    site: OwnSite,
    text: PageText,
): Finding[] {
    const { node } = located;

    const fields = [
        ...(isOfType(node, 'Article') ? ['headline'] : []),
        ...(isOfType(node, 'JobPosting') ? ['title'] : []),
        ...(mismatchNames.some((name) => isOfType(node, name)) &&
        !describesSite(node, data, site)
            ? ['name']
            : []),
    ];

    const missing = fields.flatMap((field) => {
        const value = node[field];

        if (typeof value !== 'string') {
            return [];
        }

        const decoded = decodeMarkup(value);
        const folded = fold(decoded);

        return folded !== '' && !text.folded.includes(folded)
            ? [[field, decoded]]
            : [];
    });

    const price = isOfType(node, 'Product')
        ? missingPrice(node, data, text)
        : null;

    const notInText = Object.fromEntries([
        ...missing,
        ...(price === null ? [] : [['price', price]]),
    ]);

    return Object.keys(notInText).length > 0
        ? [finding('jsonld-mismatch', url, located, { notInText })]
        : [];
}

function missingPrice(
    node: JsonNode,
    { valuesAt }: Pick<StructuredData, 'valuesAt'>,
    text: PageText,
) {
    const prices = valuesAt(node, 'offers')
        .filter(
            (offer): offer is JsonNode =>
                isNode(offer) &&
                isOfType(offer, 'Offer') &&
                !isOfType(offer, 'AggregateOffer'),
        )
        .flatMap((offer) => {
            const price = priceOf(offer.price);

            return price === null || price === 0
                ? []
                : [{ price, value: String(offer.price) }];
        });

    return prices.length === 0 ||
        prices.some(({ price }) => isPriceInText(price, text.raw))
        ? null
        : [...new Set(prices.map(({ value }) => value))].join(' or ');
}

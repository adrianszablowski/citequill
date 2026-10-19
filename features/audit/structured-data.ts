import * as cheerio from 'cheerio';

import type { JsonLdBlock, PageElement } from '@/features/audit/page';
import { isSiteUrl, withoutSlash } from '@/features/audit/queue';
import { type RichResult, richResults } from '@/features/audit/rich-results';
import {
    type SchemaOrgType,
    schemaOrgTypes,
} from '@/features/audit/schema-org';
import { absolute } from '@/features/crawl/html';
import { isWebUrl } from '@/lib/utils';

export type JsonNode = Record<string, unknown>;

export interface LocatedNode {
    node: JsonNode;
    block: PageElement;
}

interface TopNode extends LocatedNode {
    hasContext: boolean;
}

export interface OwnSite {
    url: string;
    homes: string[];
    hosts: string[];
    names: string[];
}

export type StructuredData = ReturnType<typeof structuredData>;

export function topNodes({
    value,
    error,
    selector,
    snippet,
}: JsonLdBlock): TopNode[] {
    if (error !== null) {
        return [];
    }

    const block = { selector, snippet };

    return [value]
        .flat()
        .filter(isNode)
        .flatMap((node) => {
            const hasContext = isSchemaContext(node['@context']);

            return [
                { node, block, hasContext },
                ...[node['@graph'] ?? []]
                    .flat()
                    .filter(isNode)
                    .map((item) => ({
                        node: item,
                        block,
                        hasContext:
                            hasContext || isSchemaContext(item['@context']),
                    })),
            ];
        });
}

export function structuredData(blocks: JsonLdBlock[]) {
    const read = blocks.map(topNodes);
    const top = read.flat().filter(({ hasContext }) => hasContext);

    const nodes = top.flatMap(({ node, block }): LocatedNode[] => [
        { node, block },
        ...objectsIn(node)
            .filter((object) => object['@type'] !== undefined)
            .map((object) => ({ node: object, block })),
    ]);

    const index = new Map<string, JsonNode>();

    for (const object of [
        ...top.map(({ node }) => node),
        ...nodes.map(({ node }) => node),
        ...top.flatMap(({ node }) => objectsIn(node)),
    ]) {
        const id = object['@id'];

        if (typeof id === 'string' && !isReference(object) && !index.has(id)) {
            index.set(id, object);
        }
    }

    const reviewed = new Set(
        nodes.flatMap(({ node }) =>
            reviewProperties.flatMap((property) =>
                [node[property]]
                    .flat()
                    .flatMap((value) =>
                        isNode(value) && typeof value['@id'] === 'string'
                            ? [value['@id']]
                            : [],
                    ),
            ),
        ),
    );

    const isPointedReview = (node: JsonNode) =>
        typeof node['@id'] === 'string' &&
        reviewed.has(node['@id']) &&
        (isOfType(node, 'Review') || isOfType(node, 'AggregateRating'));

    const valuesOf = (node: JsonNode, property: string) =>
        [node[property]]
            .flat()
            .map((value) => {
                if (!isNode(value) || typeof value['@id'] !== 'string') {
                    return value;
                }

                const indexed = index.get(value['@id']);

                return indexed === undefined || indexed === value
                    ? value
                    : { ...indexed, ...value };
            })
            .filter(isPresent);

    return {
        outside: read.flatMap((located) =>
            located.filter(({ hasContext }) => !hasContext).slice(0, 1),
        ),
        top: top.filter(({ node }) => !isPointedReview(node)),
        nodes,
        valuesAt: (node: JsonNode, path: string) =>
            path
                .split('.')
                .reduce<unknown[]>(
                    (values, property) =>
                        values
                            .filter(isNode)
                            .flatMap((value) => valuesOf(value, property)),
                    [node],
                ),
    };
}

export function typesOf(node: JsonNode) {
    return [node['@type']]
        .flat()
        .filter((type): type is string => typeof type === 'string')
        .map((type) => type.trim().replace(schemaPrefix, ''));
}

export function isDefinedType(type: string) {
    return Object.hasOwn(schemaOrgTypes, type);
}

export function isA(type: string, ancestor: SchemaOrgType) {
    return ancestry(type).includes(ancestor);
}

export function isOfType(node: JsonNode, ancestor: SchemaOrgType) {
    return typesOf(node).some((type) => isA(type, ancestor));
}

export function featuresOf(node: JsonNode, isMerchant: boolean) {
    const named = typesOf(node).flatMap((type) => {
        for (const candidate of ancestry(type)) {
            const feature = richResults.find(
                (result) =>
                    result.types.some((listed) => listed === candidate) &&
                    (result.isMerchantListing === undefined ||
                        result.isMerchantListing === isMerchant),
            );

            if (feature) {
                return [{ type: candidate, feature }];
            }
        }

        return [];
    });

    return [
        ...new Set(
            named
                .filter(
                    ({ type }) =>
                        !named.some(
                            (other) =>
                                other.type !== type &&
                                ancestry(other.type).includes(type),
                        ),
                )
                .map(({ feature }) => feature),
        ),
    ];
}

export function missingProperties(
    node: JsonNode,
    feature: RichResult,
    list: RichResult['required'],
    { valuesAt }: Pick<StructuredData, 'valuesAt'>,
) {
    const listed = [...feature.required, ...feature.recommended].flat();

    const has = (path: string) => {
        if (feature.feature !== 'breadcrumb' || path !== trailItem) {
            return valuesAt(node, path).length > 0;
        }

        const items = valuesAt(node, 'itemListElement').slice(0, -1);

        return (
            items.length === 0 ||
            items
                .filter(isNode)
                .some((item) => valuesAt(item, 'item').length > 0)
        );
    };

    return list.flatMap((entry) => {
        const alternatives = [entry].flat();

        if (alternatives.some(has)) {
            return [];
        }

        const reported = alternatives.filter(
            (path) =>
                !parentPaths(path).some(
                    (parent) => listed.includes(parent) && !has(parent),
                ),
        );

        return reported.length > 0 ? [reported.join(' or ')] : [];
    });
}

export function fold(text: string) {
    return text
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
}

export function decodeMarkup(value: string) {
    return cheerio.load(value, null, false).text();
}

export function priceOf(value: unknown) {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value >= 0 ? value : null;
    }

    return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())
        ? Number(value)
        : null;
}

export function isPriceInText(price: number, text: string) {
    const cents = price.toFixed(2).replace('.', '');
    const digits = cents.endsWith('00') ? [cents, cents.slice(0, -2)] : [cents];

    return [...text.matchAll(numberRun)].some(([run]) => {
        const parts = run.split(/\p{Zs}+/u);

        return parts.some((_, start) =>
            parts.slice(start).some((_, length) =>
                digits.includes(
                    parts
                        .slice(start, start + length + 1)
                        .join('')
                        .replace(/\D/g, ''),
                ),
            ),
        );
    });
}

export function describesSite(
    node: JsonNode,
    { valuesAt }: Pick<StructuredData, 'valuesAt'>,
    { url, homes, names }: OwnSite,
) {
    const base = new URL(url);
    const homeUrls = homes.map(withoutSlash);
    const id = node['@id'];

    return (
        [
            ...(typeof id === 'string' && isWebUrl(id) ? [id] : []),
            ...valuesAt(node, 'url'),
        ].some((value) => {
            const resolved = typeof value === 'string' && absolute(value, base);

            return resolved && homeUrls.includes(withoutSlash(resolved));
        }) ||
        valuesAt(node, 'name').some((name) => {
            const folded = typeof name === 'string' && fold(decodeMarkup(name));

            return folded && names.includes(folded);
        })
    );
}

export function isMerchantListing(
    node: JsonNode,
    data: Pick<StructuredData, 'valuesAt'>,
    site: OwnSite,
) {
    const base = new URL(site.url);

    return data
        .valuesAt(node, 'offers')
        .filter(isNode)
        .some(
            (offer) =>
                data.valuesAt(offer, 'url').some((value) => {
                    const resolved =
                        typeof value === 'string' && absolute(value, base);

                    return resolved && isSiteUrl(resolved, site.hosts);
                }) ||
                data
                    .valuesAt(offer, 'seller')
                    .filter(isNode)
                    .some((seller) => describesSite(seller, data, site)),
        );
}

export function declaredSize(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
        const size = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(value);

        return size ? Number(size[1]) : null;
    }

    return isNode(value) ? declaredSize(value.value) : null;
}

export function jsonLdImages(
    { nodes, valuesAt }: Pick<StructuredData, 'nodes' | 'valuesAt'>,
    url: string,
) {
    const base = new URL(url);

    return [
        ...new Set(
            nodes.flatMap(({ node }) =>
                imageProperties
                    .flatMap((property) => valuesAt(node, property))
                    .flatMap((value) =>
                        isNode(value) && isOfType(value, 'ImageObject')
                            ? [
                                  ...valuesAt(value, 'url'),
                                  ...valuesAt(value, 'contentUrl'),
                              ]
                            : [value],
                    )
                    .flatMap((value) =>
                        typeof value === 'string'
                            ? (absolute(value, base) ?? [])
                            : [],
                    ),
            ),
        ),
    ];
}

export function isNode(value: unknown): value is JsonNode {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const schemaOrgUrl = /^https?:\/\/schema\.org\/?$/i;

const schemaPrefix = /^(?:https?:\/\/schema\.org\/|schema:)/i;

const numberRun = /\d+(?:[\p{Zs}.,'’]\d+)*/gu;

const imageProperties = ['image', 'logo', 'thumbnailUrl'];

const reviewProperties = ['review', 'aggregateRating'];

const trailItem = 'itemListElement.item';

function isSchemaContext(context: unknown): boolean {
    return [context]
        .flat()
        .some((entry) =>
            isNode(entry)
                ? isSchemaContext(entry['@vocab'])
                : typeof entry === 'string' && schemaOrgUrl.test(entry.trim()),
        );
}

function ancestry(type: string) {
    const types = [type];

    for (let i = 0; i < types.length; i++) {
        const parents: readonly string[] = isDefinedType(types[i])
            ? schemaOrgTypes[types[i] as SchemaOrgType]
            : [];

        for (const parent of parents) {
            if (!types.includes(parent)) {
                types.push(parent);
            }
        }
    }

    return types;
}

function parentPaths(path: string) {
    const properties = path.split('.');

    return properties
        .slice(1)
        .map((_, i) => properties.slice(0, i + 1).join('.'));
}

function objectsIn(node: JsonNode): JsonNode[] {
    return Object.entries(node).flatMap(([key, value]) =>
        key === '@graph' || key === '@context'
            ? []
            : [value]
                  .flat()
                  .filter(isNode)
                  .flatMap((child) => [child, ...objectsIn(child)]),
    );
}

function isReference(value: unknown): value is { '@id': string } {
    return (
        isNode(value) &&
        typeof value['@id'] === 'string' &&
        Object.keys(value).length === 1
    );
}

function isPresent(value: unknown) {
    if (typeof value === 'string') {
        return value.trim() !== '';
    }

    if (isNode(value)) {
        return Object.keys(value).length > 0;
    }

    return value !== undefined && value !== null;
}

import type * as cheerio from 'cheerio';

import {
    isNode,
    isOfType,
    type JsonNode,
} from '@/features/audit/structured-data';
import { absolute } from '@/features/crawl/html';

export interface Signals {
    description: string | null;
    siteName: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    canonical: string | null;
    jsonLd: unknown[];
    emails: string[];
    phones: string[];
    socialLinks: string[];
    logo: string | null;
    headerLogo: string | null;
    sameAs: string[];
    footer: string;
}

export const footerChars = 1_500;

export const jsonLdChars = 6_000;

export function readSignals($: cheerio.CheerioAPI, base: URL): Signals {
    const nodes = jsonLdNodes($);
    const jsonLd = nodes.filter(isTypeOfInterest);
    const ids = idIndex(nodes);
    const organizations = organizationsIn(nodes, ids);

    const organization =
        organizations.find((node) => logoOf(node.logo, base, ids)) ??
        organizations[0];

    const hrefs = $('a[href]')
        .toArray()
        .map((element) => $(element).attr('href')?.trim() ?? '');

    return {
        description: meta($, 'meta[name="description"]'),
        siteName:
            organizationName(organizations) ??
            meta($, 'meta[property="og:site_name"]'),
        ogTitle: meta($, 'meta[property="og:title"]'),
        ogDescription: meta($, 'meta[property="og:description"]'),
        canonical: $('link[rel="canonical"]').attr('href')?.trim() || null,
        jsonLd: capJson(jsonLd, jsonLdChars),
        emails: unique(
            hrefs
                .filter((href) => /^mailto:/i.test(href))
                .map((href) => href.slice('mailto:'.length).split('?')[0]),
        ),
        phones: unique(
            hrefs
                .filter((href) => /^tel:/i.test(href))
                .map((href) => href.slice('tel:'.length)),
        ),
        socialLinks: unique(
            hrefs.map((href) => absolute(href, base) ?? '').filter(isProfile),
        ),
        logo: organization ? logoOf(organization.logo, base, ids) : null,
        headerLogo: headerLogo($, base),
        sameAs: unique(
            [organization?.sameAs]
                .flat()
                .map((href) => urlOf(href, base) ?? ''),
        ),
        footer: $('footer')
            .text()
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, footerChars),
    };
}

export function jsonLdNodes($: cheerio.CheerioAPI): unknown[] {
    return jsonLdBlocks($).flatMap(({ value, error }) =>
        error === null ? flatten(value) : [],
    );
}

export function jsonLdBlocks($: cheerio.CheerioAPI) {
    return $('script[type="application/ld+json"]')
        .toArray()
        .filter((element) => $(element).text().trim() !== '')
        .map((element) => {
            try {
                return {
                    element,
                    value: JSON.parse($(element).text()) as unknown,
                    error: null,
                };
            } catch (error) {
                return {
                    element,
                    value: null,
                    error: (error as SyntaxError).message,
                };
            }
        });
}

const typesOfInterest = new Set([
    'website',
    'product',
    'softwareapplication',
    'webapplication',
    'mobileapplication',
    'service',
    'offer',
    'aggregateoffer',
    'faqpage',
    'person',
    'aggregaterating',
    'review',
    'contactpoint',
    'postaladdress',
]);

const sharePaths =
    /^\/(?:sharer|share|shareArticle|intent|submit|pin\/create)(?:[/.?]|$)/i;

const socialHosts =
    /(^|\.)(x\.com|twitter\.com|linkedin\.com|facebook\.com|instagram\.com|youtube\.com|github\.com|tiktok\.com|threads\.net|bsky\.app|mastodon\.social|pinterest\.com|medium\.com|producthunt\.com|crunchbase\.com|g2\.com|capterra\.com|trustpilot\.com|discord\.gg|discord\.com|t\.me|reddit\.com)$/i;

function meta($: cheerio.CheerioAPI, selector: string) {
    return $(selector).first().attr('content')?.trim() || null;
}

function flatten(node: unknown): unknown[] {
    if (Array.isArray(node)) {
        return node.flatMap(flatten);
    }

    if (!node || typeof node !== 'object') {
        return [];
    }

    const { '@graph': graph, ...rest } = node as Record<string, unknown>;

    return [rest, ...flatten(graph)];
}

function isTypeOfInterest(node: unknown) {
    const type = (node as Record<string, unknown>)['@type'];
    const types = Array.isArray(type) ? type : [type];

    return (
        isOrganization(node) ||
        types.some(
            (entry) =>
                typeof entry === 'string' &&
                typesOfInterest.has(entry.split('/').pop()!.toLowerCase()),
        )
    );
}

function isOrganization(node: unknown): node is JsonNode {
    return (
        isNode(node) &&
        (isOfType(node, 'Organization') || isOfType(node, 'Brand'))
    );
}

function idIndex(nodes: unknown[]) {
    return new Map(
        nodes
            .filter(isNode)
            .filter((node) => typeof node['@id'] === 'string')
            .map((node) => [node['@id'] as string, node]),
    );
}

function resolved(value: unknown, ids: Map<string, JsonNode>) {
    const id = isNode(value) ? value['@id'] : undefined;
    const indexed = typeof id === 'string' ? ids.get(id) : undefined;

    return indexed ? { ...indexed, ...(value as JsonNode) } : value;
}

function organizationsIn(nodes: unknown[], ids: Map<string, JsonNode>) {
    return nodes
        .flatMap((node) => [
            node,
            ...(isNode(node) ? [node.publisher].flat() : []),
        ])
        .map((node) => resolved(node, ids))
        .filter(isOrganization);
}

function isProfile(url: string) {
    const parsed = URL.parse(url);

    return (
        parsed !== null &&
        socialHosts.test(parsed.hostname) &&
        !sharePaths.test(parsed.pathname)
    );
}

function organizationName(organizations: Record<string, unknown>[]) {
    for (const { name } of organizations) {
        if (typeof name === 'string' && name.trim()) {
            return name.trim();
        }
    }

    return null;
}

function logoOf(
    logo: unknown,
    base: URL,
    ids: Map<string, JsonNode>,
): string | null {
    const first = resolved([logo].flat()[0], ids);

    if (first && typeof first === 'object') {
        const { url, contentUrl } = first as Record<string, unknown>;

        return urlOf(url, base) ?? urlOf(contentUrl, base);
    }

    return urlOf(first, base);
}

function headerLogo($: cheerio.CheerioAPI, base: URL) {
    const images = $('header').first().find('img').toArray();

    const image =
        images.find((element) =>
            isHomeLink($(element).closest('a[href]').attr('href'), base),
        ) ??
        images.find((element) =>
            ['src', 'alt', 'class'].some((name) =>
                /logo/i.test(element.attribs[name] ?? ''),
            ),
        );

    return absolute(image?.attribs.src, base);
}

function isHomeLink(href: string | undefined, base: URL) {
    const url = URL.parse(absolute(href, base) ?? '');

    return url?.origin === base.origin && url.pathname === '/';
}

function urlOf(value: unknown, base: URL) {
    return typeof value === 'string' ? absolute(value.trim(), base) : null;
}

function capJson(nodes: unknown[], limit: number) {
    const kept: unknown[] = [];
    let used = 0;

    for (const node of nodes) {
        const size = JSON.stringify(node).length;

        if (used + size > limit) {
            break;
        }

        kept.push(node);
        used += size;
    }

    return kept;
}

function unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
}

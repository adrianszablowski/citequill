import type * as cheerio from 'cheerio';

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
    footer: string;
}

export const footerChars = 1_500;

export const jsonLdChars = 6_000;

export function readSignals($: cheerio.CheerioAPI, base: URL): Signals {
    const jsonLd = jsonLdNodes($).filter(isTypeOfInterest);

    const hrefs = $('a[href]')
        .toArray()
        .map((element) => $(element).attr('href')?.trim() ?? '');

    return {
        description: meta($, 'meta[name="description"]'),
        siteName:
            organizationName(jsonLd) ??
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
            hrefs.filter((href) => socialHosts.test(hostOf(href, base))),
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
    'organization',
    'corporation',
    'localbusiness',
    'onlinebusiness',
    'brand',
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

    return types.some(
        (entry) =>
            typeof entry === 'string' &&
            typesOfInterest.has(entry.split('/').pop()!.toLowerCase()),
    );
}

function organizationName(nodes: unknown[]) {
    for (const node of nodes) {
        const record = node as Record<string, unknown>;
        const type = String(record['@type'] ?? '').toLowerCase();

        if (
            /organization|corporation|business|brand/.test(type) &&
            typeof record.name === 'string' &&
            record.name.trim()
        ) {
            return record.name.trim();
        }
    }

    return null;
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

function hostOf(href: string, base: URL) {
    try {
        return new URL(href, base).hostname;
    } catch {
        return '';
    }
}

function unique(values: string[]) {
    return [...new Set(values.filter(Boolean))];
}

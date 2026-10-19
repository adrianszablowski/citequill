import { randomBytes } from 'node:crypto';

import type { Finding } from '@/features/audit/finding';
import {
    canonicalOf,
    googlebotDirectives,
    isIndexable,
} from '@/features/audit/observe';
import { readAuditPage } from '@/features/audit/page';
import {
    domainRoot,
    isHttpUrl,
    isSiteUrl,
    isUnderDomain,
    type QueueEntry,
    withoutSlash,
} from '@/features/audit/queue';
import { gateShare } from '@/features/audit/score';
import { type Fetched, isHtml } from '@/features/crawl/fetch';
import type { Json } from '@/lib/types/database';

export type LinkedHosts = Record<string, string>;

export interface Variant {
    url: string;
    variant: 'www' | 'slash' | 'case';
}

export interface HttpTwin {
    url: string;
    variant: 'http';
}

export const linkedHostCap = 500;

export const randomPathLength = 24;

export const contentPathPrefixes = 10;

export function randomPathToken() {
    return Array.from(
        randomBytes(randomPathLength),
        (byte) => tokenAlphabet[byte % tokenAlphabet.length],
    ).join('');
}

export function randomPathTargets(
    hosts: string[],
    baseUrls: string[],
    token: string,
) {
    const bases = [...hosts.map((host) => `https://${host}`), ...baseUrls].map(
        withoutSlash,
    );

    return [...new Set(bases)].map((base) => ({
        base,
        url: `${base}/${token}`,
    }));
}

export function judgeMissingPath(
    fetched: Fetched,
    base: string,
    homes: string[],
    hosts: string[],
): Finding | null {
    const finalUrl = new URL(fetched.url).href;

    const probe = {
        url: null,
        subject: base,
        detail: {
            reason: 'probe',
            url: fetched.hops[0].url,
            status: fetched.status,
            finalUrl,
        },
    };

    const isHome = [...homes, ...hosts.map((host) => `https://${host}/`)]
        .map(withoutSlash)
        .includes(withoutSlash(finalUrl));

    if (isHome) {
        return { ...probe, check: 'redirect-to-home' };
    }

    return fetched.status === 200 ? { ...probe, check: 'soft-404' } : null;
}

export function hostVariants(url: string): (Variant | HttpTwin)[] {
    const original = new URL(url);
    const { hostname, pathname } = original;

    const twin = hostname.startsWith('www.')
        ? hostname.slice(4)
        : `www.${hostname}`;

    const variants: (Variant | HttpTwin)[] = [
        { url: withUrl(original, { hostname: twin }), variant: 'www' },
        {
            url: withUrl(original, {
                pathname: pathname.endsWith('/')
                    ? pathname.slice(0, -1)
                    : `${pathname}/`,
            }),
            variant: 'slash',
        },
        {
            url: withUrl(original, { pathname: upperFirstLetter(pathname) }),
            variant: 'case',
        },
        ...(original.protocol === 'https:'
            ? [
                  {
                      url: withUrl(original, { protocol: 'http:' }),
                      variant: 'http' as const,
                  },
              ]
            : []),
    ];

    return variants.filter((variant) => variant.url !== original.href);
}

export function judgeVariant(
    url: string,
    { url: variantUrl, variant }: Variant,
    fetched: Fetched,
): Finding | null {
    if (fetched.hops.length !== 1 || fetched.status !== 200) {
        return null;
    }

    const canonical = canonicalOf(
        isHtml(fetched.headers)
            ? readAuditPage(fetched.body, variantUrl).canonical
            : null,
        fetched.headers,
        variantUrl,
    );

    return canonical === url
        ? null
        : {
              check: 'host-variants',
              url,
              subject: variantUrl,
              detail: { variant, status: fetched.status },
          };
}

export function judgeHttpTwin(url: string, fetched: Fetched): Finding | null {
    return fetched.status === 200 && isHttpUrl(fetched.url)
        ? {
              check: 'https-missing',
              url,
              subject: fetched.hops[0].url,
              detail: {
                  reason: 'no-redirect',
                  status: fetched.status,
                  finalUrl: fetched.url,
                  hops: fetched.hops as unknown as Json,
              },
          }
        : null;
}

export function stagingHosts(linked: LinkedHosts, domain: string) {
    const root = domainRoot(domain);

    return Object.entries(linked).filter(
        ([host]) =>
            isUnderDomain(host, domain) &&
            host
                .slice(0, -root.length - 1)
                .split('.')
                .some((label) => stagingLabel.test(label)),
    );
}

export function judgeStaging(
    host: string,
    url: string,
    fetched: Fetched,
): Finding | null {
    if (fetched.hops.length !== 1 || fetched.status !== 200) {
        return null;
    }

    const directives = googlebotDirectives(
        isHtml(fetched.headers)
            ? readAuditPage(fetched.body, fetched.url).robotsMeta
            : [],
        fetched.headers.get('x-robots-tag'),
    );

    return isIndexable(fetched.status, directives)
        ? {
              check: 'staging-indexable',
              url: null,
              subject: host,
              detail: { url, status: fetched.status },
          }
        : null;
}

export function contentPaths(
    queue: Iterable<QueueEntry>,
    isDisallowed: (url: string) => boolean,
): Finding | null {
    const linked = [...queue].filter((entry) => entry.depth !== null);
    const blocked = linked.filter((entry) => isDisallowed(entry.url));

    if (linked.length === 0 || blocked.length / linked.length <= gateShare) {
        return null;
    }

    const counts = new Map<string, number>();

    for (const { url } of blocked) {
        const prefix = `/${new URL(url).pathname.split('/')[1]}`;

        counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }

    const prefixes = [...counts]
        .sort(([a, one], [b, other]) => other - one || a.localeCompare(b))
        .slice(0, contentPathPrefixes)
        .map(([prefix]) => prefix);

    return {
        check: 'robots-googlebot-blocked',
        url: null,
        subject: 'content-paths',
        detail: {
            reason: 'content-paths',
            blocked: blocked.length,
            linked: linked.length,
            prefixes,
        },
    };
}

export function linkedHosts(
    current: LinkedHosts,
    links: string[],
    hosts: string[],
) {
    const next = { ...current };

    for (const link of links) {
        const { hostname } = new URL(link);

        if (Object.keys(next).length >= linkedHostCap) {
            break;
        }

        if (!isSiteUrl(link, hosts) && !(hostname in next)) {
            next[hostname] = link;
        }
    }

    return next;
}

const tokenAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

const stagingLabel = /^(?:staging|stage|dev|test|uat|preprod|sandbox)$/i;

const escapeOrNonLetter = /^((?:%[\da-f]{2}|[^\p{L}%])*)(\p{L})/iu;

function withUrl(
    url: URL,
    parts: Partial<Pick<URL, 'hostname' | 'pathname' | 'protocol'>>,
) {
    const next = new URL(url);

    Object.assign(next, parts);

    return next.href;
}

function upperFirstLetter(pathname: string) {
    const segments = pathname.split('/');
    const last = segments.findLastIndex(Boolean);

    if (last === -1) {
        return pathname;
    }

    segments[last] = segments[last].replace(
        escapeOrNonLetter,
        (_, before: string, letter: string) =>
            `${before}${letter.toUpperCase()}`,
    );

    return segments.join('/');
}

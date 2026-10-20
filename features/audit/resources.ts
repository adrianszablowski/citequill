import type { Finding } from '@/features/audit/finding';
import { isMalformedHref } from '@/features/audit/link-checks';
import type { AuditPage } from '@/features/audit/page';
import {
    isInternalUrl,
    isSiteUrl,
    withLinkingPage,
} from '@/features/audit/queue';
import { jsonLdImages } from '@/features/audit/structured-data';
import type { Fetched, FetchOptions } from '@/features/crawl/fetch';
import type { Enums, Tables } from '@/lib/types/database';

export type ResourceKind = Enums<'audit_resource_kind'>;

export type Resource = Omit<Tables<'audit_resources'>, 'audit_id'>;

export type Frontier = ReadonlyMap<string, Resource>;

export interface ResourceCandidate {
    url: string;
    kind: ResourceKind;
    from: string;
}

export interface ResourceAnswer {
    status: number | null;
    contentLength: number | null;
    error: string | null;
    finalUrl: string | null;
    isUncached: boolean;
}

export type ReadUrl = (
    url: string,
    options?: Pick<FetchOptions, 'method'>,
) => Promise<Fetched | Error | null>;

export const resourceCaps = { external: 2_000, internal: 5_000 };

export const imgHeavyBytes = 100_000;

export const getAfterHead = new Set([405, 501]);

export const refusals = new Set([403, 429]);

export function externalLinks(
    url: string,
    page: Pick<AuditPage, 'anchors'>,
    hosts: string[],
) {
    return [
        ...new Set(
            page.anchors.flatMap(({ href, url: link }) =>
                href !== null &&
                link !== null &&
                !isMalformedHref(href, url) &&
                !isSiteUrl(link, hosts)
                    ? [link]
                    : [],
            ),
        ),
    ];
}

export function pageResources(
    url: string,
    page: Pick<
        AuditPage,
        'structuredData' | 'ogImages' | 'images' | 'assets' | 'anchors'
    >,
    hosts: string[],
    domain: string,
    isIndexable: boolean,
): ResourceCandidate[] {
    const kinds: [ResourceKind, string[]][] = [
        [
            'jsonld_image',
            isIndexable ? jsonLdImages(page.structuredData, url) : [],
        ],
        ['og_image', page.ogImages],
        [
            'image',
            page.images.flatMap((image) =>
                image.tag === 'img' &&
                image.src &&
                isInternalUrl(image.src, hosts, domain)
                    ? [image.src]
                    : [],
            ),
        ],
        ['asset', page.assets],
        ['external', externalLinks(url, page, hosts)],
    ];

    const seen = new Map<string, ResourceKind>();

    for (const [kind, urls] of kinds) {
        for (const resource of urls) {
            if (!seen.has(resource)) {
                seen.set(resource, kind);
            }
        }
    }

    return [...seen].map(([resource, kind]) => ({
        url: resource,
        kind,
        from: url,
    }));
}

export function addResources(
    frontier: Frontier,
    candidates: ResourceCandidate[],
) {
    const next = new Map(frontier);
    const touched = new Set<string>();

    const counts = { external: 0, internal: 0 };

    for (const { kind } of next.values()) {
        counts[capOf(kind)] += 1;
    }

    for (const { url, kind, from } of candidates) {
        const known = next.get(url);

        if (known) {
            next.set(url, {
                ...known,
                linked_from: withLinkingPage(known.linked_from, from),
                link_count:
                    known.link_count +
                    (known.linked_from.includes(from) ? 0 : 1),
            });

            touched.add(url);

            continue;
        }

        const cap = capOf(kind);

        if (counts[cap] >= resourceCaps[cap]) {
            continue;
        }

        counts[cap] += 1;

        next.set(url, {
            url,
            kind,
            linked_from: [from],
            link_count: 1,
            state: 'queued',
            status_code: null,
            content_length: null,
            error: null,
        });

        touched.add(url);
    }

    return { frontier: next, touched: [...touched] };
}

export async function askResource(read: ReadUrl, url: string) {
    const head = await read(url, { method: 'HEAD' });

    return head instanceof Error ||
        head === null ||
        !getAfterHead.has(head.status)
        ? head
        : read(url, { method: 'GET' });
}

export function answerOf(outcome: Fetched | Error): ResourceAnswer {
    if (outcome instanceof Error) {
        return {
            status: null,
            contentLength: null,
            error: outcome.message,
            finalUrl: null,
            isUncached: false,
        };
    }

    const header = outcome.headers.get('content-length');
    const length = header === null ? Number.NaN : Number(header);

    return {
        status: outcome.status,
        contentLength:
            Number.isInteger(length) && length >= 0 && length <= maxInteger
                ? length
                : null,
        error: null,
        finalUrl: outcome.url,
        isUncached:
            !outcome.headers.has('cache-control') &&
            !outcome.headers.has('expires'),
    };
}

export function refusedAnswer(status: number): ResourceAnswer {
    return {
        status,
        contentLength: null,
        error: null,
        finalUrl: null,
        isUncached: false,
    };
}

export function isForeignResource(
    { url, kind }: Pick<Resource, 'url' | 'kind'>,
    hosts: string[],
    domain: string,
) {
    return kind === 'external' || !isInternalUrl(url, hosts, domain);
}

export function refusedHosts(
    rows: Pick<Resource, 'url' | 'kind' | 'status_code'>[],
    isForeign: (row: Pick<Resource, 'url' | 'kind'>) => boolean,
) {
    const hosts = new Map<string, number>();

    for (const row of rows) {
        if (
            row.status_code !== null &&
            refusals.has(row.status_code) &&
            isForeign(row)
        ) {
            hosts.set(new URL(row.url).hostname, row.status_code);
        }
    }

    return hosts;
}

export function findingPages(
    { kind, linked_from }: Pick<Resource, 'kind' | 'linked_from'>,
    sample: ReadonlySet<string>,
) {
    return kind === 'asset'
        ? linked_from.filter((page) => sample.has(page))
        : linked_from;
}

export function isSampledAsset(
    row: Pick<Resource, 'kind' | 'linked_from'>,
    sample: ReadonlySet<string>,
) {
    return row.kind !== 'asset' || findingPages(row, sample).length > 0;
}

export function judgeResource(
    row: Pick<Resource, 'url' | 'kind' | 'linked_from' | 'link_count'>,
    answer: ResourceAnswer,
    isForeign: boolean,
    sample: ReadonlySet<string>,
): Finding[] {
    const verdict = verdictOf(row.kind, answer, isForeign);

    if (!verdict) {
        return [];
    }

    return findingPages(row, sample).map((page) => ({
        check: verdict.check,
        url: page,
        subject: row.url,
        detail: {
            ...(verdict.reason && { reason: verdict.reason }),
            status: answer.status,
            finalUrl: answer.finalUrl,
            ...(answer.error !== null && { error: answer.error }),
            ...(verdict.check === 'img-heavy' && {
                bytes: answer.contentLength,
            }),
            linkCount: row.link_count,
        },
    }));
}

const maxInteger = 2_147_483_647;

function capOf(kind: ResourceKind) {
    return kind === 'external' ? 'external' : 'internal';
}

function verdictOf(
    kind: ResourceKind,
    { status, contentLength: bytes, isUncached }: ResourceAnswer,
    isForeign: boolean,
): { check: Finding['check']; reason?: string } | null {
    if (isForeign && status !== null && refusals.has(status)) {
        return { check: 'link-external-refused', reason: 'refused' };
    }

    if (kind === 'external') {
        return status === null || status >= 400
            ? { check: 'link-broken-external' }
            : null;
    }

    if (kind === 'og_image') {
        return status === 200
            ? null
            : { check: 'og-image-bad', reason: 'image' };
    }

    if (kind === 'jsonld_image') {
        return status === 200 ? null : { check: 'jsonld-image-unreachable' };
    }

    if (status !== 200) {
        return { check: 'resource-broken' };
    }

    if (kind === 'asset') {
        return isUncached ? { check: 'assets-uncached' } : null;
    }

    return kind === 'image' && bytes !== null && bytes > imgHeavyBytes
        ? { check: 'img-heavy' }
        : null;
}

import { readAuditPage, thinPageWords } from '@/features/audit/page';
import {
    type Candidate,
    linkDepth,
    linkTarget,
    type QueueEntry,
} from '@/features/audit/queue';
import { type Fetched, type Hop, isHtml } from '@/features/crawl/fetch';
import { absolute } from '@/features/crawl/html';
import { type Locale, localeOf } from '@/features/crawl/locales';
import type { Json, TablesInsert } from '@/lib/types/database';

export interface Read {
    entry: QueueEntry;
    outcome: Fetched | Error | 'blocked';
}

export interface ReadContext {
    projectId: string;
    auditId: string;
    locales: Locale[];
    hosts: string[];
    pageIds: Map<string, string>;
}

export interface Answer {
    hops: Hop[];
    title: string | null;
    canonical: string | null;
    directives: string[];
}

export interface Observation {
    status_code: number | null;
    final_url: string | null;
    redirect_to: string | null;
    is_indexable: boolean;
    canonical_url: string | null;
    title: string | null;
}

export function observeRead(
    { entry, outcome }: Read,
    { projectId, auditId, locales, hosts, pageIds }: ReadContext,
) {
    const fetched =
        outcome === 'blocked' || outcome instanceof Error ? null : outcome;

    const page =
        fetched?.ok && fetched.hops.length === 1 && isHtml(fetched.headers)
            ? readAuditPage(fetched.body, fetched.url)
            : null;

    const directives = googlebotDirectives(
        page?.robotsMeta ?? [],
        fetched?.headers.get('x-robots-tag') ?? null,
    );

    const observation = observePage(
        fetched && {
            hops: fetched.hops,
            title: page?.title ?? null,
            canonical:
                page?.canonical ??
                headerCanonical(fetched.headers.get('link'), fetched.url),
            directives,
        },
    );

    const row: TablesInsert<'site_pages'> = {
        project_id: projectId,
        url: entry.url,
        locale: localeOf(entry.url, locales) ?? page?.lang ?? null,
        ...observation,
        is_blocked: outcome === 'blocked',
        body_hash: page?.bodyHash ?? null,
        body_simhash:
            page && page.wordCount >= thinPageWords ? page.simhash : null,
        description: page?.descriptions[0]?.content || null,
        image_count: page?.images.length ?? 0,
        hreflang: page ? (page.alternates as unknown as Json) : null,
        in_sitemap: entry.in_sitemap,
        click_depth: entry.depth,
        page_id: pageIds.get(entry.url.replace(/\/$/, '')) ?? null,
        last_audit_id: auditId,
    };

    const links: Candidate[] = (page?.links ?? []).flatMap((href) => {
        const url = linkTarget(href, hosts);

        return url && url !== entry.url
            ? [{ url, depth: linkDepth(entry.depth), inbound: 1 }]
            : [];
    });

    const landing =
        observation.redirect_to && observation.final_url
            ? linkTarget(observation.final_url, hosts)
            : null;

    return {
        row,
        page,
        directives,
        candidates:
            landing && landing !== entry.url
                ? [...links, { url: landing, depth: entry.depth }]
                : links,
    };
}

export function observePage(answer: Answer | null): Observation {
    const [first, next] = answer?.hops ?? [];

    if (!answer || !first) {
        return unanswered;
    }

    if (next) {
        return {
            ...unanswered,
            status_code: first.status,
            final_url: answer.hops.at(-1)!.url,
            redirect_to: next.url,
        };
    }

    return {
        status_code: first.status,
        final_url: first.url,
        redirect_to: null,
        is_indexable: isIndexable(first.status, answer.directives),
        canonical_url: answer.canonical,
        title: answer.title,
    };
}

export function isIndexable(status: number, directives: string[]) {
    return (
        status === 200 &&
        !directives.some((directive) => noindex.has(directive))
    );
}

export function googlebotDirectives(
    robotsMeta: string[],
    robotsHeader: string | null,
) {
    return [
        ...robotsMeta.flatMap((content) => content.split(',')),
        ...headerDirectives(robotsHeader ?? ''),
    ]
        .map((directive) => directive.trim().toLowerCase())
        .filter(Boolean);
}

export function headerCanonical(header: string | null, url: string) {
    for (const [, href, params] of (header ?? '').matchAll(
        /<([^>]*)>([^<]*)/g,
    )) {
        const rel = /rel\s*=\s*"?([^";,]*)/i.exec(params)?.[1] ?? '';

        if (rel.toLowerCase().split(/\s+/).includes('canonical')) {
            return absolute(href, new URL(url));
        }
    }

    return null;
}

const unanswered: Observation = {
    status_code: null,
    final_url: null,
    redirect_to: null,
    is_indexable: false,
    canonical_url: null,
    title: null,
};

const noindex = new Set(['noindex', 'none']);

const valued = new Set([
    'max-snippet',
    'max-image-preview',
    'max-video-preview',
    'unavailable_after',
]);

function headerDirectives(header: string) {
    const directives: string[] = [];
    let agent: string | null = null;

    for (const part of header.split(',')) {
        const scoped = /^\s*([\w-]+)\s*:(.*)$/.exec(part);
        let directive = part;

        if (scoped && !valued.has(scoped[1].toLowerCase())) {
            agent = scoped[1].toLowerCase();
            directive = scoped[2];
        }

        if (agent === null || agent === 'googlebot') {
            directives.push(directive);
        }
    }

    return directives;
}

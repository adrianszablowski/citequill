import {
    type AuditPage,
    readAuditPage,
    thinPageWords,
} from '@/features/audit/page';
import { isHtmlAnswer } from '@/features/audit/performance-checks';
import {
    type Candidate,
    linkDepth,
    linkTarget,
    type QueueEntry,
    withoutSlash,
} from '@/features/audit/queue';
import { externalLinks, pageResources } from '@/features/audit/resources';
import { type Fetched, type Hop, isHtml } from '@/features/crawl/fetch';
import {
    absolute,
    type Alternate,
    type HreflangEntry,
    hreflangAlternates,
} from '@/features/crawl/html';
import { type Locale, localeOf } from '@/features/crawl/locales';
import type { Json, TablesInsert } from '@/lib/types/database';

export interface Read {
    entry: QueueEntry;
    outcome: Fetched | Error | 'blocked';
    secondReadMs?: number;
}

export interface ReadContext {
    projectId: string;
    auditId: string;
    locales: Locale[];
    hosts: string[];
    domain: string;
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
    { projectId, auditId, locales, hosts, domain, pageIds }: ReadContext,
) {
    const fetched =
        outcome === 'blocked' || outcome instanceof Error ? null : outcome;

    const answer = fetched?.ok && fetched.hops.length === 1 ? fetched : null;

    const page =
        answer && isHtml(answer.headers)
            ? readAuditPage(answer.body, answer.url)
            : null;

    const directives = googlebotDirectives(
        page?.robotsMeta ?? [],
        fetched?.headers.get('x-robots-tag') ?? null,
    );

    const observation = observePage(
        fetched && {
            hops: fetched.hops,
            title: page?.title ?? null,
            canonical: canonicalOf(
                page?.canonical ?? null,
                fetched.headers,
                fetched.url,
            ),
            directives,
        },
    );

    const alternates = answer
        ? alternateSets(page, answer.headers, entry)
        : null;

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
        external_link_count: page
            ? externalLinks(entry.url, page, hosts).length
            : 0,
        hreflang: alternates
            ? (hreflangAlternates([
                  ...alternates.tags,
                  ...alternates.header,
              ]) as unknown as Json)
            : null,
        hreflang_count: alternates ? alternateCount(alternates) : 0,
        jsonld_count: page?.jsonLd.length ?? 0,
        has_microdata: page?.hasMicrodata ?? false,
        is_article: page?.isArticle ?? false,
        is_shell:
            fetched !== null &&
            isHtmlAnswer(fetched) &&
            !fetched.isTruncated &&
            page?.isShell === true,
        in_sitemap: entry.in_sitemap,
        click_depth: entry.depth,
        page_id: pageIds.get(withoutSlash(entry.url)) ?? null,
        last_audit_id: auditId,
    };

    const links: Candidate[] = (page?.links ?? []).flatMap((href) => {
        const url = linkTarget(href, hosts);

        return url && url !== entry.url
            ? [
                  {
                      url,
                      depth: linkDepth(entry.depth),
                      inbound: 1,
                      from: entry.url,
                  },
              ]
            : [];
    });

    const landing =
        observation.redirect_to && observation.final_url
            ? linkTarget(observation.final_url, hosts)
            : null;

    const alternateCandidates = [
        ...new Set(
            allAlternates(alternates).flatMap(({ url }) =>
                url ? (linkTarget(url, hosts) ?? []) : [],
            ),
        ),
    ]
        .filter((url) => url !== entry.url)
        .map((url) => ({ url, depth: null }));

    return {
        row,
        page,
        directives,
        alternates,
        resources: page
            ? pageResources(
                  entry.url,
                  page,
                  hosts,
                  domain,
                  observation.is_indexable,
              )
            : [],
        candidates: [
            ...links,
            ...(landing && landing !== entry.url
                ? [{ url: landing, depth: entry.depth }]
                : []),
            ...alternateCandidates,
        ],
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
    return agentDirectives('googlebot', robotsMeta, robotsHeader);
}

export function bingbotDirectives(
    robotsMeta: string[],
    robotsHeader: string | null,
) {
    return agentDirectives('bingbot', robotsMeta, robotsHeader);
}

export function snippetLimit(directive: string) {
    const [name, ...rest] = directive.split(':');

    if (name.trim() !== 'max-snippet') {
        return undefined;
    }

    const value = rest.join(':').trim();

    return /^-?\d+$/.test(value) ? Number(value) : null;
}

export function canonicalOf(
    htmlCanonical: string | null,
    headers: Headers,
    url: string,
) {
    return htmlCanonical ?? headerCanonical(headers.get('link'), url);
}

export function headerCanonical(header: string | null, url: string) {
    const canonical = linkHeaderEntries(header).find(({ rel }) =>
        rel.includes('canonical'),
    );

    return canonical ? absolute(canonical.href, new URL(url)) : null;
}

export function headerAlternates(
    header: string | null,
    url: string,
): HreflangEntry[] {
    return linkHeaderEntries(header).flatMap(({ href, rel, hreflang }) =>
        rel.includes('alternate') &&
        !rel.includes('stylesheet') &&
        hreflang !== null &&
        href !== ''
            ? [{ lang: hreflang, href, url: absolute(href, new URL(url)) }]
            : [],
    );
}

export function linkHeaderEntries(header: string | null) {
    return [...(header ?? '').matchAll(/<([^>]*)>([^<]*)/g)].map(
        ([, href, params]) => ({
            href: href.trim(),
            rel: (linkParam(params, 'rel') ?? '').toLowerCase().split(/\s+/),
            hreflang: linkParam(params, 'hreflang'),
            type: linkParam(params, 'type'),
        }),
    );
}

export function alternateSets(
    page: Pick<AuditPage, 'alternateTags'> | null,
    headers: Headers,
    { url, alternates }: Pick<QueueEntry, 'url' | 'alternates'>,
) {
    return {
        tags: page?.alternateTags ?? [],
        header: headerAlternates(headers.get('link'), url),
        sitemap: storedAlternates(alternates).map(
            ({ lang, href }): HreflangEntry => ({
                lang,
                href,
                url: absolute(href, new URL(url)),
            }),
        ),
    };
}

export type AlternateSets = ReturnType<typeof alternateSets>;

export function allAlternates(alternates: AlternateSets | null) {
    return alternates ? Object.values(alternates).flat() : [];
}

export function alternateCount(alternates: AlternateSets) {
    return new Set(
        allAlternates(alternates).map(({ url, href }) => url ?? href),
    ).size;
}

export function storedAlternates(json: Json | null | undefined) {
    return Array.isArray(json) ? (json as unknown as Alternate[]) : [];
}

const linkParams = {
    rel: /;\s*rel\s*=\s*"?([^";,]*)/i,
    hreflang: /;\s*hreflang\s*=\s*"?([^";,]*)/i,
    type: /;\s*type\s*=\s*"?([^";,]*)/i,
};

function linkParam(params: string, name: keyof typeof linkParams) {
    return linkParams[name].exec(params)?.[1].trim() ?? null;
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

function directiveParts(value: string) {
    const parts: string[] = [];

    for (const part of value.split(',')) {
        const previous = parts.at(-1);

        // An RFC 850 or RFC 822 date has a comma before its day, and no
        // directive or crawler name starts with a digit as the day does.
        if (
            previous !== undefined &&
            /unavailable_after\s*:[^,]*$/i.test(previous) &&
            /^\s*\d/.test(part)
        ) {
            parts[parts.length - 1] = `${previous},${part}`;
        } else {
            parts.push(part);
        }
    }

    return parts;
}

function agentDirectives(
    agent: string,
    robotsMeta: string[],
    robotsHeader: string | null,
) {
    return [
        ...robotsMeta.flatMap(directiveParts),
        ...headerDirectives(robotsHeader ?? '', agent),
    ]
        .map((directive) => directive.trim().toLowerCase())
        .filter(Boolean);
}

function headerDirectives(header: string, target: string) {
    const directives: string[] = [];
    let agent: string | null = null;

    for (const part of directiveParts(header)) {
        const scoped = /^\s*([\w-]+)\s*:(.*)$/.exec(part);
        let directive = part;

        if (scoped && !valued.has(scoped[1].toLowerCase())) {
            agent = scoped[1].toLowerCase();
            directive = scoped[2];
        }

        if (agent === null || agent === target) {
            directives.push(directive);
        }
    }

    return directives;
}

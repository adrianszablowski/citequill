import { aiAccessChecks } from '@/features/audit/ai-access-checks';
import type { Finding } from '@/features/audit/finding';
import { heuristicChecks } from '@/features/audit/heuristic-checks';
import { hreflangChecks } from '@/features/audit/hreflang-checks';
import { httpsChecks } from '@/features/audit/https-checks';
import { imageChecks } from '@/features/audit/image-checks';
import { linkChecks } from '@/features/audit/link-checks';
import { viewportChecks } from '@/features/audit/mobile-checks';
import {
    canonicalOf,
    googlebotDirectives,
    headerCanonical,
    type observeRead,
    type Read,
    snippetLimit,
} from '@/features/audit/observe';
import { onPageChecks } from '@/features/audit/on-page-checks';
import { type CanonicalTag, thinPageWords } from '@/features/audit/page';
import { performanceChecks } from '@/features/audit/performance-checks';
import { isHttpUrl } from '@/features/audit/queue';
import { shapeChecks } from '@/features/audit/shape-checks';
import { structuredDataChecks } from '@/features/audit/structured-data-checks';
import {
    type Fetched,
    maxBytes,
    maxHops,
    tlsErrorOf,
} from '@/features/crawl/fetch';
import { absolute } from '@/features/crawl/html';
import {
    isSameLanguage,
    type Locale,
    localeOf,
} from '@/features/crawl/locales';
import type { Json } from '@/lib/types/database';

export interface PageCheckContext {
    obeyRobots: boolean;
    isDisallowed: (url: string) => boolean;
    aiSearchBlocked: (url: string) => string[];
    locales: Locale[];
    hosts: string[];
    homes: string[];
    projectName: string;
    domain: string;
    previousRedirects: ReadonlyMap<string, string>;
    now: number;
}

export type Observed = Pick<
    ReturnType<typeof observeRead>,
    'row' | 'page' | 'directives' | 'alternates'
>;

export function checkPage(
    { entry, outcome, secondReadMs }: Read,
    observed: Observed,
    context: PageCheckContext,
): Finding[] {
    const { url } = entry;

    if (outcome === 'blocked') {
        return [];
    }

    if (outcome instanceof Error) {
        const code = tlsErrorOf(outcome);

        return [
            code === null
                ? { check: 'page-5xx', url, detail: { error: outcome.message } }
                : {
                      check: 'tls-invalid',
                      url,
                      detail: {
                          code,
                          error:
                              (outcome.cause instanceof Error &&
                                  outcome.cause.message) ||
                              outcome.message,
                      },
                  },
        ];
    }

    const status = outcome.hops[0].status;

    return [
        ...statusFindings(url, status),
        ...redirectFindings(url, outcome),
        ...temporaryFindings(url, outcome, context.previousRedirects),
        ...(outcome.hops.length === 1 && status === 200
            ? answerFindings(url, outcome, observed, context, secondReadMs)
            : []),
    ];
}

function statusFindings(url: string, status: number): Finding[] {
    if (status >= 500 || status === 429) {
        return [{ check: 'page-5xx', url, detail: { status } }];
    }

    return status >= 400
        ? [{ check: 'page-4xx', url, detail: { status } }]
        : [];
}

function redirectFindings(url: string, { hops }: Fetched): Finding[] {
    if (hops.length < 2) {
        return [];
    }

    const last = hops.at(-1)!;
    const target = hops[1].url;

    const redirect = {
        url,
        subject: target,
        detail: { hops: hops as unknown as Json },
    };

    const downgrade = isHttpUrl(hops[0].url)
        ? undefined
        : hops.find((hop) => isHttpUrl(hop.url));

    const downgrades: Finding[] = downgrade
        ? [{ ...redirect, check: 'https-to-http', subject: downgrade.url }]
        : [];

    if (new Set(hops.map((hop) => hop.url)).size < hops.length) {
        return [{ ...redirect, check: 'redirect-loop' }, ...downgrades];
    }

    const isStillRedirecting = hops.length > maxHops && isRedirect(last.status);

    const checks: Finding['check'][] = [
        ...(isStillRedirecting ? ['redirect-chain-long' as const] : []),
        ...(!isStillRedirecting && hops.length > 2
            ? ['redirect-chain' as const]
            : []),
        ...(last.status >= 400 ? ['redirect-to-error' as const] : []),
        ...(onlySlashOrCase(url, target)
            ? ['redirect-slash-or-case' as const]
            : []),
    ];

    return [...checks.map((check) => ({ ...redirect, check })), ...downgrades];
}

function temporaryFindings(
    url: string,
    { hops }: Fetched,
    previousRedirects: ReadonlyMap<string, string>,
): Finding[] {
    const [first, next] = hops;

    return next &&
        temporaryStatuses.has(first.status) &&
        previousRedirects.get(url) === next.url
        ? [
              {
                  check: 'redirect-temporary',
                  url,
                  subject: next.url,
                  detail: { status: first.status, target: next.url },
              },
          ]
        : [];
}

function answerFindings(
    url: string,
    fetched: Fetched,
    { row, page, directives, alternates }: Observed,
    context: PageCheckContext,
    secondReadMs: number | undefined,
): Finding[] {
    const { obeyRobots, isDisallowed, locales, now } = context;
    const findings: Finding[] = [];
    const isIndexable = row.is_indexable === true;

    if (page && fetched.bytes > maxBytes) {
        findings.push({
            check: 'html-over-2mb',
            url,
            detail: { bytes: fetched.bytes },
        });
    }

    const meta = googlebotDirectives(page?.robotsMeta ?? [], null);
    const header = googlebotDirectives([], fetched.headers.get('x-robots-tag'));

    if (conflicts(meta, header)) {
        findings.push({
            check: 'robots-conflict',
            url,
            detail: { meta, header },
        });
    }

    const invalid = directives.filter(isInvalidDirective);

    if (invalid.length > 0) {
        findings.push({
            check: 'robots-invalid',
            url,
            snippet: invalid[0],
            detail: { directives: invalid },
        });
    }

    if (directives.includes('none')) {
        findings.push({ check: 'robots-none', url });
    }

    const removal = valueOf(directives, 'unavailable_after');

    if (isIndexable && removal !== null && Date.parse(removal) < now) {
        findings.push({
            check: 'unavailable-after-past',
            url,
            snippet: `unavailable_after: ${removal}`,
        });
    }

    if (!isIndexable && !obeyRobots && isDisallowed(url)) {
        findings.push({ check: 'noindex-blocked', url });
    }

    if (!isIndexable && (row.page_id || row.in_sitemap)) {
        findings.push({
            check: 'noindex-content',
            url,
            detail: { isCitequillPage: Boolean(row.page_id) },
        });
    }

    if (isIndexable && page && !row.canonical_url) {
        findings.push({ check: 'canonical-missing', url });
    }

    findings.push(...httpsChecks(url, fetched, page, context));

    return [
        ...findings,
        ...(page
            ? [
                  ...canonicalFindings(url, fetched, page, locales),
                  ...contentFindings(url, page, isIndexable),
                  ...heuristicChecks(url, row, page, directives, context),
                  ...performanceChecks(url, fetched, page, secondReadMs),
                  ...(isIndexable
                      ? [
                            ...onPageChecks(url, page, fetched, now),
                            ...imageChecks(url, page.images),
                            ...linkChecks(url, page, context),
                            ...viewportChecks(url, page),
                            ...structuredDataChecks(url, page, context),
                            ...shapeChecks(url, page, context),
                        ]
                      : []),
              ]
            : []),
        ...(isIndexable && alternates
            ? hreflangChecks(url, page, alternates)
            : []),
        ...(isIndexable
            ? aiAccessChecks(url, fetched, page, directives, context)
            : []),
    ];
}

function canonicalFindings(
    url: string,
    fetched: Fetched,
    page: NonNullable<Observed['page']>,
    locales: Locale[],
): Finding[] {
    const tag =
        (check: Finding['check']) =>
        (canonical: CanonicalTag): Finding => ({
            check,
            url,
            subject: canonical.href,
            selector: canonical.selector,
            snippet: canonical.snippet,
        });

    const findings = [
        ...page.canonicals
            .filter((canonical) => !canonical.isInHead)
            .map(tag('canonical-outside-head')),
        ...page.canonicals
            .filter(
                ({ href }) => !/^https?:\/\//i.test(href) || href.includes('#'),
            )
            .map(tag('canonical-relative')),
    ];

    const fromHeader = headerCanonical(fetched.headers.get('link'), url);

    const targets = new Set(
        page.canonicals.flatMap(
            ({ href }) => absolute(href, new URL(url)) ?? [],
        ),
    );

    const target = canonicalOf(page.canonical, fetched.headers, url);

    if (
        targets.size > 1 ||
        (fromHeader !== null &&
            page.canonical !== null &&
            fromHeader !== page.canonical)
    ) {
        findings.push({
            check: 'canonical-conflict',
            url,
            subject: target,
            detail: { html: [...targets], header: fromHeader },
        });
    }

    const pageLocale = localeOf(url, locales);
    const targetLocale = target && localeOf(target, locales);

    if (
        target &&
        ((!isHttpUrl(url) && isHttpUrl(target)) ||
            (pageLocale && targetLocale && pageLocale !== targetLocale))
    ) {
        findings.push({
            check: 'canonical-language',
            url,
            subject: target,
            detail: { pageLocale, targetLocale },
        });
    }

    return findings;
}

function contentFindings(
    url: string,
    page: NonNullable<Observed['page']>,
    isIndexable: boolean,
): Finding[] {
    const findings: Finding[] = [];

    if (page.refresh !== null && /url\s*=/i.test(page.refresh)) {
        findings.push({
            check: 'redirect-meta',
            url,
            snippet: `<meta http-equiv="refresh" content="${page.refresh}">`,
        });
    }

    if (!isIndexable) {
        return findings;
    }

    const self = page.alternates.find(
        (alternate) => alternate.href === url && alternate.lang !== 'x-default',
    );

    if (
        !page.lang ||
        !languageTag.test(page.lang) ||
        (self && !isSameLanguage(page.lang, self.lang))
    ) {
        findings.push({
            check: 'html-lang',
            url,
            detail: { lang: page.lang, hreflang: self?.lang ?? null },
        });
    }

    if (page.wordCount < thinPageWords) {
        findings.push({
            check: 'thin-page',
            url,
            detail: { words: page.wordCount },
        });
    }

    return findings;
}

const temporaryStatuses = new Set([302, 303, 307]);

const languageTag = /^[a-z]{2,3}(-[a-z0-9]{1,8})*$/i;

const opposites = [
    ['index', 'noindex'],
    ['follow', 'nofollow'],
];

const implied: Record<string, string[]> = {
    all: ['index', 'follow'],
    none: ['noindex', 'nofollow'],
};

function isRedirect(status: number) {
    return status >= 300 && status < 400;
}

function onlySlashOrCase(from: string, to: string) {
    const a = new URL(from);
    const b = new URL(to);
    const path = (url: URL) => url.pathname.toLowerCase().replace(/\/+$/, '');

    return (
        from !== to &&
        a.origin === b.origin &&
        a.search === b.search &&
        path(a) === path(b)
    );
}

function conflicts(meta: string[], header: string[]) {
    const expand = (directives: string[]) =>
        new Set(
            directives.flatMap((directive) => implied[directive] ?? directive),
        );

    const one = expand(meta);
    const other = expand(header);

    return opposites.some(
        ([yes, no]) =>
            (one.has(yes) && other.has(no)) || (one.has(no) && other.has(yes)),
    );
}

function valueOf(directives: string[], name: string) {
    const directive = directives.find((candidate) =>
        candidate.startsWith(`${name}:`),
    );

    return directive ? directive.slice(name.length + 1).trim() : null;
}

function isInvalidDirective(directive: string) {
    if (snippetLimit(directive) === null) {
        return true;
    }

    const [name, ...rest] = directive.split(':');

    return (
        name.trim() === 'unavailable_after' &&
        Number.isNaN(Date.parse(rest.join(':').trim()))
    );
}

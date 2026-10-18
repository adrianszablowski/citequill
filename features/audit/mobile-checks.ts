import type { Finding } from '@/features/audit/finding';
import { googlebotDirectives, isIndexable } from '@/features/audit/observe';
import { type AuditPage, readAuditPage } from '@/features/audit/page';
import { isSiteUrl } from '@/features/audit/queue';
import { type Fetched, isHtml } from '@/features/crawl/fetch';

export const phoneWordShare = 0.9;

export const missingLinkShare = 0.1;

export const comparedHeadingLevel = 3;

export function viewportChecks(
    url: string,
    { viewport }: Pick<AuditPage, 'viewport'>,
): Finding[] {
    if (viewport === null) {
        return [{ check: 'viewport-missing', url }];
    }

    const pairs = new Map(
        viewport.split(/[,;]/).map((pair) => {
            const [key, ...value] = pair.split('=');

            return [
                key.trim().toLowerCase(),
                value.join('=').trim().toLowerCase(),
            ];
        }),
    );

    const width = pairs.get('width');

    const reasons = [
        ...(width === undefined ? ['no-width'] : []),
        ...(width !== undefined && /^\d+(\.\d+)?(px)?$/i.test(width)
            ? ['numeric-width']
            : []),
        ...(['no', '0'].includes(pairs.get('user-scalable') ?? '')
            ? ['not-scalable']
            : []),
    ];

    return reasons.length > 0
        ? [
              {
                  check: 'viewport-misconfigured',
                  url,
                  detail: { content: viewport, reasons },
              },
          ]
        : [];
}

export function judgeMobile(
    url: string,
    desktop: Fetched,
    phone: Fetched,
    hosts: string[],
): Finding | null {
    if (!isHtmlAnswer(desktop) || !isHtmlAnswer(phone)) {
        return null;
    }

    const wide = sideOf(desktop, hosts);
    const narrow = sideOf(phone, hosts);

    const missingLinks = [...wide.links].filter(
        (link) => !narrow.links.has(link),
    );

    const reasons = [
        ...(wide.headings.some((heading) => !narrow.headings.includes(heading))
            ? ['headings']
            : []),
        ...(wide.words > 0 && narrow.words < phoneWordShare * wide.words
            ? ['words']
            : []),
        ...(wide.links.size > 0 &&
        missingLinks.length > missingLinkShare * wide.links.size
            ? ['links']
            : []),
        ...(narrow.isNoindex && !wide.isNoindex ? ['noindex'] : []),
        ...(wide.title === narrow.title ? [] : ['title']),
        ...(wide.description === narrow.description ? [] : ['description']),
    ];

    return reasons.length > 0
        ? {
              check: 'mobile-content-differs',
              url,
              subject: phone.url,
              detail: {
                  reasons,
                  desktop: countsOf(wide),
                  phone: countsOf(narrow),
              },
          }
        : null;
}

type Side = ReturnType<typeof sideOf>;

function isHtmlAnswer(fetched: Fetched) {
    return fetched.status === 200 && isHtml(fetched.headers);
}

function sideOf(fetched: Fetched, hosts: string[]) {
    const page = readAuditPage(fetched.body, fetched.url);
    const ownHost = new URL(fetched.url).hostname;

    return {
        headings: page.headings
            .filter(
                ({ level, text }) =>
                    level <= comparedHeadingLevel && text !== '',
            )
            .map(({ text }) => text.toLowerCase()),
        words: page.wordCount,
        links: new Set(
            page.links
                .filter(
                    (link) =>
                        isSiteUrl(link, hosts) ||
                        new URL(link).hostname === ownHost,
                )
                .map(pathAndQuery),
        ),
        isNoindex: !isIndexable(
            200,
            googlebotDirectives(
                page.robotsMeta,
                fetched.headers.get('x-robots-tag'),
            ),
        ),
        title: collapsed(page.title),
        description: collapsed(page.descriptions[0]?.content),
    };
}

function countsOf({ headings, words, links }: Side) {
    return { headings: headings.length, words, links: links.size };
}

function pathAndQuery(url: string) {
    const { pathname, search } = new URL(url);

    return `${pathname.replace(/\/+$/, '')}${search}`;
}

function collapsed(text: string | null | undefined) {
    return (text ?? '').replace(/\s+/g, ' ').trim();
}

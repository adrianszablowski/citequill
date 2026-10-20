import type { Finding } from '@/features/audit/finding';
import { canonicalOf } from '@/features/audit/observe';
import type { AuditPage } from '@/features/audit/page';
import { modifiedDates } from '@/features/audit/structured-data';
import { titleWidth, titleWidthLimit } from '@/features/audit/title-width';
import type { Fetched } from '@/features/crawl/fetch';

export const descriptionLength = { min: 70, max: 160 };

export const h1MaxLength = 70;

export const textRatioMin = 0.1;

export const staleDays = 183;

export const urlShape = { maxLength: 115, maxParameters: 4 };

export const openGraphTags = [
    'og:title',
    'og:description',
    'og:image',
    'og:url',
    'og:type',
];

export const stuffing = { letters: 4, repeats: 3 };

export function onPageChecks(
    url: string,
    page: AuditPage,
    { headers }: Pick<Fetched, 'headers'>,
    now: number,
): Finding[] {
    return [
        ...titleFindings(url, page),
        ...descriptionFindings(url, page),
        ...headingFindings(url, page),
        ...headFindings(url, page, headers),
        ...textFindings(url, page),
        ...staleFindings(url, page, headers, now),
        ...urlFindings(url),
        ...openGraphFindings(url, page),
        ...ogUrlFindings(url, page, canonicalOf(page.canonical, headers, url)),
    ];
}

export function repeatedWord(text: string) {
    const counts = new Map<string, number>();

    for (const token of text.toLowerCase().split(/\s+/)) {
        const word = token.replace(/[^\p{L}\p{N}]/gu, '');

        if ((word.match(/\p{L}/gu)?.length ?? 0) >= stuffing.letters) {
            counts.set(word, (counts.get(word) ?? 0) + 1);
        }
    }

    return (
        [...counts].find(([, count]) => count >= stuffing.repeats)?.[0] ?? null
    );
}

function titleFindings(url: string, { titles }: AuditPage): Finding[] {
    const [title] = titles;

    const reason = presenceFault(titles, title?.text);

    if (reason) {
        return [
            {
                check: 'title-missing',
                url,
                ...(title && {
                    selector: title.selector,
                    snippet: title.snippet,
                }),
                detail: { reason, count: titles.length },
            },
        ];
    }

    const findings: Finding[] = [];
    const word = repeatedWord(title.text);
    const width = titleWidth(title.text);

    if (word) {
        findings.push({
            check: 'title-stuffed',
            url,
            snippet: title.snippet,
            detail: { word },
        });
    }

    if (width > titleWidthLimit) {
        findings.push({
            check: 'title-width',
            url,
            snippet: title.snippet,
            detail: { width: Math.round(width) },
        });
    }

    return findings;
}

function descriptionFindings(
    url: string,
    { descriptions }: AuditPage,
): Finding[] {
    const [description] = descriptions;

    const reason = presenceFault(descriptions, description?.content);

    if (reason) {
        return [
            {
                check: 'description-missing',
                url,
                detail: { reason, count: descriptions.length },
            },
        ];
    }

    const length = [...description.content].length;

    return length < descriptionLength.min || length > descriptionLength.max
        ? [{ check: 'description-length', url, detail: { length } }]
        : [];
}

function headingFindings(url: string, { h1s, headings }: AuditPage) {
    const findings: Finding[] = [];

    if (!h1s[0]) {
        findings.push({ check: 'h1-missing', url });
    }

    const firstLength = [...(h1s[0] ?? '')].length;

    if (h1s.length > 1 || firstLength > h1MaxLength) {
        findings.push({
            check: 'h1-count',
            url,
            detail: { count: h1s.length, length: firstLength },
        });
    }

    let previous = 1;

    for (const heading of headings) {
        if (heading.level > previous + 1) {
            findings.push({
                check: 'heading-order',
                url,
                selector: heading.selector,
                snippet: heading.snippet,
                detail: { level: heading.level, previous },
            });

            break;
        }

        previous = heading.level;
    }

    return findings;
}

function headFindings(
    url: string,
    { hasDoctype, hasMetaCharset, misplaced }: AuditPage,
    headers: Headers,
): Finding[] {
    const hasCharset =
        hasMetaCharset || /charset=/i.test(headers.get('content-type') ?? '');

    const reasons = [
        ...(hasDoctype ? [] : ['doctype']),
        ...(hasCharset ? [] : ['charset']),
        ...(misplaced.length > 0 ? ['head-element-in-body'] : []),
    ];

    return reasons.length > 0
        ? [
              {
                  check: 'head-invalid',
                  url,
                  ...(misplaced[0] && {
                      selector: misplaced[0].selector,
                      snippet: misplaced[0].snippet,
                  }),
                  detail: { reasons },
              },
          ]
        : [];
}

function textFindings(
    url: string,
    { visibleText, markupLength, plugins }: AuditPage,
): Finding[] {
    const findings: Finding[] = [];
    const lorem = /lorem ipsum|dolor sit amet/i.exec(visibleText);

    if (lorem) {
        findings.push({
            check: 'lorem-ipsum',
            url,
            snippet: visibleText.slice(
                Math.max(0, lorem.index - 40),
                lorem.index + lorem[0].length + 40,
            ),
        });
    }

    if (plugins.length > 0) {
        findings.push({
            check: 'plugins',
            url,
            selector: plugins[0].selector,
            snippet: plugins[0].snippet,
            detail: { elements: [...new Set(plugins.map(({ name }) => name))] },
        });
    }

    const ratio = markupLength > 0 ? visibleText.length / markupLength : 1;

    if (ratio < textRatioMin) {
        findings.push({
            check: 'text-ratio',
            url,
            detail: { ratio: Math.round(ratio * 1000) / 1000 },
        });
    }

    return findings;
}

function staleFindings(
    url: string,
    { modifiedTime, jsonLd }: AuditPage,
    headers: Headers,
    now: number,
): Finding[] {
    const lastModified = headers.get('last-modified');
    const dateModified = newest(modifiedDates(jsonLd));

    const times = [lastModified, modifiedTime, dateModified]
        .map((value) => Date.parse(value ?? ''))
        .filter(Number.isFinite);

    return times.length > 0 &&
        Math.max(...times) < now - staleDays * 24 * 60 * 60 * 1000
        ? [
              {
                  check: 'content-stale',
                  url,
                  detail: { lastModified, modifiedTime, dateModified },
              },
          ]
        : [];
}

function newest(dates: string[]) {
    return dates.reduce<string | null>((latest, date) => {
        const time = Date.parse(date);

        return Number.isFinite(time) &&
            (latest === null || time > Date.parse(latest))
            ? date
            : latest;
    }, null);
}

function urlFindings(url: string): Finding[] {
    const { pathname, searchParams } = new URL(url);
    const path = decoded(pathname, decodeURIComponent);

    const reasons = [
        ...(path.includes('_') ? ['underscore'] : []),
        ...(/\p{Lu}/u.test(path) ? ['uppercase'] : []),
        ...(path.includes('//') ? ['double-slash'] : []),
        ...([...searchParams].length > urlShape.maxParameters
            ? ['parameters']
            : []),
        ...([...decoded(url, decodeURI)].length > urlShape.maxLength
            ? ['length']
            : []),
    ];

    return reasons.length > 0
        ? [{ check: 'url-shape', url, detail: { reasons } }]
        : [];
}

function openGraphFindings(url: string, { openGraph }: AuditPage): Finding[] {
    const missing = openGraphTags.filter((tag) => !openGraph.includes(tag));

    return missing.length > 0
        ? [{ check: 'og-missing', url, detail: { missing } }]
        : [];
}

function ogUrlFindings(
    url: string,
    { ogUrl }: AuditPage,
    canonical: string | null,
): Finding[] {
    return ogUrl !== null && canonical !== null && ogUrl !== canonical
        ? [
              {
                  check: 'og-image-bad',
                  url,
                  subject: ogUrl,
                  detail: { reason: 'url', canonical },
              },
          ]
        : [];
}

function presenceFault(tags: { isInHead: boolean }[], value?: string) {
    if (tags.length === 0) {
        return 'none';
    }

    if (tags.length > 1) {
        return 'several';
    }

    if (!value) {
        return 'empty';
    }

    return tags[0].isInHead ? null : 'outside-head';
}

function decoded(text: string, decode: (text: string) => string) {
    try {
        return decode(text);
    } catch {
        return text;
    }
}

import { findingsPerPage } from '@/features/audit/finding';
import type { AltState } from '@/features/audit/image-checks';
import type { PageImage } from '@/features/audit/images';
import type { Json } from '@/lib/types/database';
import { formatCount, formatDate } from '@/lib/utils';

export const stalledMessage = 'The audit made no progress for 15 minutes.';

export interface Changes {
    difference: number;
    since: string;
    fixed: number;
    added: number;
}

export function formatDuration(seconds: number) {
    if (seconds < 60) {
        return `${seconds} s`;
    }

    const minutes = Math.round(seconds / 60);

    if (minutes < 60) {
        return `${minutes} min`;
    }

    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function startedAgo(iso: string, now: number) {
    const minutes = Math.floor((now - Date.parse(iso)) / 60_000);

    if (minutes < 1) {
        return 'Started less than a minute ago.';
    }

    return minutes === 1
        ? 'Started a minute ago.'
        : `Started ${minutes} minutes ago.`;
}

export function changesLine({ difference, since, fixed, added }: Changes) {
    const sign = difference > 0 ? '+' : '';
    const change = difference === 0 ? 'No change' : `${sign}${difference}`;
    const findings = fixed === 1 ? 'finding' : 'findings';

    return `${change} since ${formatDate(since)}, ${formatCount(fixed)} ${findings} fixed, ${formatCount(added)} new`;
}

export function altAsShown(alt: string) {
    return Object.hasOwn(altStates, alt)
        ? altStates[alt as keyof typeof altStates]
        : `"${alt}"`;
}

export function ancestorAsShown(ancestor: string) {
    return Object.hasOwn(ancestors, ancestor)
        ? ancestors[ancestor as keyof typeof ancestors]
        : ancestor;
}

export function detailLines(detail: Json | null | undefined) {
    if (!isRecord(detail)) {
        return [];
    }

    return Object.entries(detail).flatMap(([key, value]) => {
        if (key === 'total') {
            return typeof value === 'number' && value > findingsPerPage
                ? [`and ${formatCount(value - findingsPerPage)} more`]
                : [];
        }

        const label = detailLabels[key];
        const text = value === undefined ? '' : valueAsShown(value);

        return label === undefined || text === '' ? [] : [`${label}: ${text}`];
    });
}

function valueAsShown(value: Json): string {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number') {
        return formatCount(value);
    }

    if (Array.isArray(value)) {
        return value.filter(isScalar).map(valueAsShown).join(', ');
    }

    if (isRecord(value)) {
        return Object.entries(value)
            .filter((entry): entry is [string, string | number] =>
                isScalar(entry[1]),
            )
            .map(([key, scalar]) => `${key} ${valueAsShown(scalar)}`)
            .join(', ');
    }

    return '';
}

function isScalar(value: Json | undefined): value is string | number {
    return typeof value === 'string' || typeof value === 'number';
}

function isRecord(
    value: Json | null | undefined,
): value is { [key: string]: Json | undefined } {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const altStates = {
    absent: 'No alt attribute',
    empty: 'Empty alt',
    whitespace: 'Whitespace alt',
} satisfies Record<AltState, string>;

const ancestors = {
    link: 'In a link',
    figure: 'In a figure',
} satisfies Record<NonNullable<PageImage['ancestor']>, string>;

const detailLabels: Record<string, string> = {
    missing: 'Missing',
    reasons: 'Reasons',
    code: 'Code',
    error: 'Error',
    status: 'Status',
    finalUrl: 'Final URL',
    contentType: 'Content-Type',
    content: 'Viewport',
    desktop: 'Desktop',
    phone: 'Phone',
    target: 'Target',
    redirectTo: 'Redirects to',
    redirectedTo: 'Redirected to',
    next: 'Next canonical',
    canonical: 'Canonical',
    duplicates: 'Duplicates',
    word: 'Word',
    phrase: 'Phrase',
    parameter: 'Parameter',
    path: 'Path',
    prefixes: 'Paths',
    directives: 'Directives',
    meta: 'Meta tag',
    header: 'Header',
    html: 'HTML',
    elements: 'Elements',
    count: 'Count',
    length: 'Length',
    words: 'Words',
    level: 'Level',
    previous: 'Previous level',
    ratio: 'Ratio',
    bytes: 'Bytes',
    redirects: 'Redirects',
    urls: 'URLs',
    sitemaps: 'Sitemaps',
    problems: 'Problems',
    rejected: 'Rejected',
    examples: 'Examples',
    example: 'Example',
    malformed: 'Malformed',
    future: 'In the future',
    overImageCap: 'Over 1 000 images',
    deprecatedImageTags: 'Deprecated image tags',
    incompleteVideos: 'Incomplete videos',
    noindexed: 'Pages with noindex',
    answered: 'Pages answered',
    blocked: 'Blocked',
    pageLocale: 'Page locale',
    targetLocale: 'Target locale',
    lang: 'Lang',
    hreflang: 'Hreflang',
    inbound: 'Inbound links',
    depth: 'Click depth',
    linkCount: 'Linking pages',
    links: 'Links',
    lastModified: 'Last-Modified',
    modifiedTime: 'article:modified_time',
    series: 'Series',
};

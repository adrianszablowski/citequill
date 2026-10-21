import { type CdnOutcome, isCdnOutcome } from '@/features/audit/cdn-test';
import { findingsPerPage } from '@/features/audit/finding';
import type { AltState } from '@/features/audit/image-checks';
import type { PageImage } from '@/features/audit/images';
import { answerFirst } from '@/features/audit/shape-checks';
import type { Json } from '@/lib/types/database';
import { formatCount, formatDate } from '@/lib/utils';

export const stalledMessage = 'The audit made no progress for 15 minutes.';

export const shellSentence =
    'Citequill read almost no text in the raw HTML of this site. Google renders JavaScript and some hosts send crawlers a prerendered copy, so the findings about the content may not hold for them.';

export function cdnTestLine(outcome: string | null) {
    if (outcome === null) {
        return 'Citequill could not finish the test of AI search agents at your CDN, so it does not count in the score.';
    }

    return isCdnOutcome(outcome) ? cdnTestLines[outcome] : null;
}

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

const cdnTestLines = {
    passed: null,
    'browser-refused':
        'Citequill could not test AI search agents at your CDN. A browser from Citequill’s address did not get the home page, which a firewall or a rate limit can cause.',
    'bot-refused':
        'Citequill could not test AI search agents at your CDN. A browser got the home page and CitequillBot did not, so the test cannot tell a rule against AI agents from a rule against every bot.',
    'spoof-refused':
        'Citequill could not test AI search agents at your CDN. A claimed Googlebot or Bingbot did not get the home page, so your CDN checks crawlers by their address and may let the real agents through.',
} satisfies Record<CdnOutcome, string | null>;

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
    lines: 'Lines',
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
    method: 'Method',
    methods: 'Methods',
    languages: 'Languages',
    listed: 'This page lists',
    listedBack: 'The alternate lists',
    notListed: 'Not listed back',
    inbound: 'Inbound links',
    depth: 'Click depth',
    linkCount: 'Linking pages',
    links: 'Links',
    lastModified: 'Last-Modified',
    modifiedTime: 'article:modified_time',
    dateModified: 'JSON-LD dateModified',
    series: 'Series',
    ms: 'Time (ms)',
    region: 'Region',
    files: 'Files',
    type: 'Type',
    types: 'Types',
    guides: 'Google’s guides',
    notInText: 'Not in the text',
    properties: 'Properties',
    declaredWidth: 'Declared width (px)',
    declaredHeight: 'Declared height (px)',
    price: 'Price',
    items: 'Items',
    agents: 'Agents',
    signals: 'Signals (agents)',
    answers: 'Answers',
    prices: 'Prices',
    vary: 'Vary',
    wordsBeforeH1: 'Words before the H1',
    mainWords: 'Words in the main text',
    wordsBeforeParagraph: `Words from the H1 to the first paragraph of ${answerFirst.paragraphWords} words or more`,
    comparedTitle: 'Title as compared',
    comparedH1s: 'H1s as compared',
    externalLinks: 'External links',
    segment: 'Last segment of the path',
};

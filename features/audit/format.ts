import type { AltState } from '@/features/audit/image-checks';
import type { PageImage } from '@/features/audit/images';
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

const altStates = {
    absent: 'No alt attribute',
    empty: 'Empty alt',
    whitespace: 'Whitespace alt',
} satisfies Record<AltState, string>;

const ancestors = {
    link: 'In a link',
    figure: 'In a figure',
} satisfies Record<NonNullable<PageImage['ancestor']>, string>;

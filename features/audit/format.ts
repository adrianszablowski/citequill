export const stalledMessage = 'The audit made no progress for 15 minutes.';

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

export { cn } from 'cn';

export function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export function formatCount(count: number) {
    return count.toLocaleString('en-GB');
}

export function formatUsd(amount: number) {
    return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
    });
}

export function pagesRead(count: number) {
    if (count === 0) {
        return 'No pages read yet.';
    }

    return count === 1
        ? '1 page read so far.'
        : `${formatCount(count)} pages read so far.`;
}

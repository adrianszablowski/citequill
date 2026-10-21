import { samplePageCount, samplePages } from '@/features/audit/sample';
import { isAnswered } from '@/features/audit/score';
import type { Tables } from '@/lib/types/database';

export type ShellPage = Pick<
    Tables<'site_pages'>,
    'url' | 'status_code' | 'redirect_to' | 'is_shell'
>;

export function isShellSite(pages: ShellPage[], homes: string[]) {
    const answered = pages.filter(isAnswered);
    const answeredHomes = answered.filter((page) => homes.includes(page.url));

    const shells = new Set(
        answered.filter((page) => page.is_shell).map((page) => page.url),
    );

    const sample = samplePages(
        answered.map((page) => page.url).sort(),
        homes,
        samplePageCount,
    );

    return (
        answeredHomes.length > 0 &&
        answeredHomes.every((page) => page.is_shell) &&
        2 * sample.filter((url) => shells.has(url)).length > sample.length
    );
}

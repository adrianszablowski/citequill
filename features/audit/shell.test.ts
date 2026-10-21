import { describe, expect, it } from 'vitest';

import { samplePageCount } from '@/features/audit/sample';
import { isShellSite, type ShellPage } from '@/features/audit/shell';

const homes = ['https://acme.com/', 'https://acme.de/'];

function page(
    url: string,
    isShell: boolean,
    answer: Partial<ShellPage> = {},
): ShellPage {
    return {
        url,
        status_code: 200,
        redirect_to: null,
        is_shell: isShell,
        ...answer,
    };
}

const shells = (...paths: string[]) =>
    paths.map((path) => page(`https://acme.com${path}`, true));

describe('isShellSite', () => {
    it('calls a site a shell when every answered home and over half of the sample are shells', () => {
        expect(
            isShellSite(
                [...shells('/', '/a', '/b'), page('https://acme.com/c', false)],
                homes,
            ),
        ).toBe(true);
    });

    it('calls no site a shell when one answered home is not', () => {
        expect(
            isShellSite(
                [page('https://acme.com/', false), ...shells('/a', '/b', '/c')],
                homes,
            ),
        ).toBe(false);
    });

    it('calls no site a shell when exactly half of the sample is', () => {
        expect(
            isShellSite(
                [
                    ...shells('/', '/a'),
                    page('https://acme.com/b', false),
                    page('https://acme.com/c', false),
                ],
                homes,
            ),
        ).toBe(false);
    });

    it('leaves out a page that did not answer 200 and one that redirects', () => {
        expect(
            isShellSite(
                [
                    ...shells('/', '/a'),
                    page('https://acme.de/', false, { status_code: 404 }),
                    page('https://acme.com/b', false, { status_code: 500 }),
                    page('https://acme.com/c', false, {
                        status_code: 301,
                        redirect_to: 'https://acme.com/a',
                    }),
                ],
                homes,
            ),
        ).toBe(true);
    });

    it('calls no site a shell when no home page answered 200', () => {
        expect(
            isShellSite(
                [
                    page('https://acme.com/', true, { status_code: 503 }),
                    ...shells('/a', '/b'),
                ],
                homes,
            ),
        ).toBe(false);

        expect(isShellSite([], homes)).toBe(false);
    });

    it('asks every locale’s home page to be a shell', () => {
        const others = shells('/a', '/b', '/c');

        expect(
            isShellSite(
                [...shells('/'), page('https://acme.de/', false), ...others],
                homes,
            ),
        ).toBe(false);

        expect(
            isShellSite(
                [...shells('/'), page('https://acme.de/', true), ...others],
                homes,
            ),
        ).toBe(true);
    });

    it(`reads a sample of ${samplePageCount} pages in URL order, whatever order the rows come in`, () => {
        const padded = (index: number) => String(index).padStart(3, '0');

        const notShells = Array.from(
            { length: samplePageCount + 1 },
            (_, index) =>
                page(`https://acme.com/b${padded(index)}/page`, false),
        );

        const sampledShells = Array.from(
            { length: samplePageCount - 1 },
            (_, index) => page(`https://acme.com/a${padded(index)}/page`, true),
        );

        expect(
            isShellSite(
                [...notShells, ...sampledShells, ...shells('/')],
                homes,
            ),
        ).toBe(true);
    });

    it('reads a sample of exactly 50 pages, so the 51st page does not count', () => {
        const pages = (prefix: string, count: number, isShell: boolean) =>
            Array.from({ length: count }, (_, index) =>
                page(
                    `https://acme.com/${prefix}${String(index).padStart(2, '0')}/page`,
                    isShell,
                ),
            );

        expect(
            isShellSite(
                [
                    ...shells('/'),
                    ...pages('a', 24, true),
                    ...pages('b', 25, false),
                    ...pages('c', 1, true),
                ],
                homes,
            ),
        ).toBe(false);
    });
});

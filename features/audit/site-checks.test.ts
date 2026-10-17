import { describe, expect, it } from 'vitest';

import { siteHosts } from '@/features/audit/queue';
import {
    type SiteContext,
    siteChecks,
    type SiteRow,
} from '@/features/audit/site-checks';

const context: SiteContext = {
    homes: ['https://acme.com/'],
    hosts: siteHosts('acme.com', ['https://acme.com']),
    isDisallowed: () => false,
    isHttpsSite: true,
};

function row(path: string, overrides: Partial<SiteRow> = {}): SiteRow {
    const url = `https://acme.com${path}`;

    return {
        id: path,
        url,
        status_code: 200,
        redirect_to: null,
        is_indexable: true,
        is_blocked: false,
        canonical_url: url,
        in_sitemap: true,
        body_hash: `hash of ${path}`,
        ...overrides,
    };
}

function checks(rows: SiteRow[], overrides: Partial<SiteContext> = {}) {
    return siteChecks(rows, { ...context, ...overrides }).map(
        ({ check, url }) => `${check} ${url}`,
    );
}

describe('siteChecks', () => {
    it('finds nothing on listed, self-canonical pages with their own content', () => {
        expect(checks([row('/a'), row('/b')])).toEqual([]);
    });

    it('reports a canonical to a page that redirects, errs or carries noindex, and none to a page the audit did not read', () => {
        const rows = [
            row('/a', { canonical_url: 'https://acme.com/moved' }),
            row('/moved', {
                status_code: 301,
                redirect_to: 'https://acme.com/new',
                is_indexable: false,
                canonical_url: null,
            }),
            row('/b', { canonical_url: 'https://acme.com/gone' }),
            row('/gone', {
                status_code: 404,
                is_indexable: false,
                canonical_url: null,
                in_sitemap: false,
            }),
            row('/c', { canonical_url: 'https://acme.com/hidden' }),
            row('/hidden', { is_indexable: false, in_sitemap: false }),
            row('/d', { canonical_url: 'https://acme.com/unread' }),
        ];

        expect(
            siteChecks(rows, context)
                .filter(({ check }) => check === 'canonical-to-error')
                .map(({ url }) => url),
        ).toEqual([
            'https://acme.com/a',
            'https://acme.com/b',
            'https://acme.com/c',
        ]);
    });

    it('reports a canonical that names a page naming another, and asks about one on another host', () => {
        const rows = [
            row('/a', { canonical_url: 'https://acme.com/b' }),
            row('/b', { canonical_url: 'https://acme.com/c' }),
            row('/c'),
            row('/syndicated', {
                canonical_url: 'https://news.other.com/story',
            }),
            row('/twin', { canonical_url: 'https://www.acme.com/twin' }),
        ];

        expect(
            siteChecks(rows, context)
                .filter(({ check }) => check.startsWith('canonical-'))
                .map(({ check, url, subject }) => [check, url, subject]),
        ).toEqual([
            ['canonical-chain', 'https://acme.com/a', 'https://acme.com/b'],
            [
                'canonical-cross-domain',
                'https://acme.com/syndicated',
                'https://news.other.com/story',
            ],
        ]);
    });

    it('reports indexable pages with the same body and no canonical between them, each once', () => {
        const rows = [
            row('/a', { body_hash: 'same' }),
            row('/b', { body_hash: 'same' }),
            row('/c', { body_hash: 'same', is_indexable: false }),
            row('/print', {
                body_hash: 'other',
                canonical_url: 'https://acme.com/article',
            }),
            row('/article', { body_hash: 'other' }),
        ];

        expect(
            siteChecks(rows, context).filter(
                ({ check }) => check === 'duplicate-body',
            ),
        ).toEqual([
            {
                check: 'duplicate-body',
                url: 'https://acme.com/a',
                subject: 'https://acme.com/b',
                detail: { duplicates: ['https://acme.com/b'] },
            },
            {
                check: 'duplicate-body',
                url: 'https://acme.com/b',
                subject: 'https://acme.com/a',
                detail: { duplicates: ['https://acme.com/a'] },
            },
        ]);
    });

    it('names the same twin as the subject of a duplicate whatever order the pages come in', () => {
        const rows = ['/c', '/a', '/b'].map((path) =>
            row(path, { body_hash: 'same' }),
        );

        const subjects = (ordered: SiteRow[]) =>
            siteChecks(ordered, context)
                .filter(({ check }) => check === 'duplicate-body')
                .map(({ url, subject, detail }) => [url, subject, detail])
                .sort();

        expect(subjects(rows)).toEqual([
            [
                'https://acme.com/a',
                'https://acme.com/b',
                { duplicates: ['https://acme.com/b', 'https://acme.com/c'] },
            ],
            [
                'https://acme.com/b',
                'https://acme.com/a',
                { duplicates: ['https://acme.com/a', 'https://acme.com/c'] },
            ],
            [
                'https://acme.com/c',
                'https://acme.com/a',
                { duplicates: ['https://acme.com/a', 'https://acme.com/b'] },
            ],
        ]);

        expect(subjects([...rows].reverse())).toEqual(subjects(rows));
    });

    it('reports an indexable self-canonical page in no sitemap, and nothing when the site lists no page at all', () => {
        expect(checks([row('/a'), row('/b', { in_sitemap: false })])).toEqual([
            'page-not-in-sitemap https://acme.com/b',
        ]);

        expect(
            checks([
                row('/a', { in_sitemap: false }),
                row('/b', { in_sitemap: false }),
            ]),
        ).toEqual([]);
    });

    it('reports a listed URL that errs or carries noindex', () => {
        expect(
            checks([
                row('/a', { status_code: 404, is_indexable: false }),
                row('/b', { is_indexable: false }),
                row('/c', { status_code: 503, is_indexable: false }),
                row('/d'),
            ]),
        ).toEqual([
            'sitemap-url-error https://acme.com/a',
            'sitemap-url-error https://acme.com/b',
            'sitemap-url-error https://acme.com/c',
        ]);
    });

    it('reports a listed URL that redirects, names another canonical, is http on an https site or is disallowed', () => {
        const findings = siteChecks(
            [
                row('/a', {
                    status_code: 301,
                    redirect_to: 'https://acme.com/b',
                    is_indexable: false,
                    canonical_url: null,
                }),
                row('/c', { canonical_url: 'https://acme.com/d' }),
                row('/d', { in_sitemap: false }),
                {
                    ...row('/e'),
                    url: 'http://acme.com/e',
                    canonical_url: null,
                },
                row('/private', {
                    status_code: null,
                    is_indexable: false,
                    is_blocked: true,
                    canonical_url: null,
                }),
            ],
            {
                ...context,
                isDisallowed: (url) => url.endsWith('/private'),
            },
        ).filter(({ check }) => check === 'sitemap-url-noncanonical');

        expect(findings.map(({ url, detail }) => [url, detail])).toEqual([
            ['https://acme.com/a', { reasons: ['redirects'] }],
            ['https://acme.com/c', { reasons: ['names another canonical'] }],
            ['http://acme.com/e', { reasons: ['http'] }],
            ['https://acme.com/private', { reasons: ['disallowed'] }],
        ]);
    });

    it('fails the site when a home page carries noindex, or over 95% of the pages that answered do', () => {
        expect(
            siteChecks(
                [row('/', { is_indexable: false }), row('/a')],
                context,
            ).filter(({ check }) => check === 'noindex-site'),
        ).toEqual([
            { check: 'noindex-site', url: null, subject: 'https://acme.com/' },
        ]);

        const many = (indexable: number) => [
            row('/'),
            ...Array.from({ length: 99 }, (_, index) =>
                row(`/p${index}`, {
                    is_indexable: index < indexable - 1,
                    in_sitemap: false,
                }),
            ),
        ];

        expect(checks(many(4))).toContain('noindex-site null');
        expect(checks(many(5))).not.toContain('noindex-site null');
    });
});

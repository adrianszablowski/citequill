import { describe, expect, it } from 'vitest';

import { siteHosts } from '@/features/audit/queue';
import {
    deepClicks,
    type SiteContext,
    siteChecks,
    type SiteRow,
} from '@/features/audit/site-checks';
import { facetVolume } from '@/features/audit/url-patterns';

const context: SiteContext = {
    homes: ['https://acme.com/'],
    hosts: siteHosts('acme.com', ['https://acme.com']),
    isDisallowed: () => false,
    isHttpsSite: true,
    linkedFrom: new Map(),
    sitemapAlternates: new Map(),
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
        image_count: 0,
        external_link_count: 0,
        hreflang_count: 0,
        jsonld_count: 0,
        is_article: false,
        has_microdata: false,
        hreflang: [],
        click_depth: 1,
        inbound_links: 2,
        body_hash: `hash of ${path}`,
        body_simhash: null,
        title: null,
        description: null,
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
                detail: {
                    value: 'same',
                    duplicates: ['https://acme.com/b'],
                },
            },
            {
                check: 'duplicate-body',
                url: 'https://acme.com/b',
                subject: 'https://acme.com/a',
                detail: {
                    value: 'same',
                    duplicates: ['https://acme.com/a'],
                },
            },
        ]);
    });

    it('compares one URL per path for duplicate-body, the first by URL, and leaves the variants of a path to param-duplicates', () => {
        const rows = [
            row('/a?ref=2', { body_hash: 'same' }),
            row('/a', { body_hash: 'same' }),
            row('/a?ref=1', { body_hash: 'same' }),
            row('/b', { body_hash: 'same' }),
        ];

        const findings = siteChecks(rows, context);

        expect(
            findings
                .filter(({ check }) => check === 'duplicate-body')
                .map(({ url, detail }) => [url, detail]),
        ).toEqual([
            [
                'https://acme.com/a',
                { value: 'same', duplicates: ['https://acme.com/b'] },
            ],
            [
                'https://acme.com/b',
                { value: 'same', duplicates: ['https://acme.com/a'] },
            ],
        ]);

        expect(
            findings
                .filter(({ check }) => check === 'param-duplicates')
                .map(({ url, subject, detail }) => [url, subject, detail]),
        ).toEqual([
            [
                'https://acme.com/a',
                'https://acme.com/a?ref=1',
                {
                    reason: 'variants',
                    value: 'same',
                    duplicates: [
                        'https://acme.com/a?ref=1',
                        'https://acme.com/a?ref=2',
                    ],
                },
            ],
            [
                'https://acme.com/a?ref=1',
                'https://acme.com/a',
                {
                    reason: 'variants',
                    value: 'same',
                    duplicates: [
                        'https://acme.com/a',
                        'https://acme.com/a?ref=2',
                    ],
                },
            ],
            [
                'https://acme.com/a?ref=2',
                'https://acme.com/a',
                {
                    reason: 'variants',
                    value: 'same',
                    duplicates: [
                        'https://acme.com/a',
                        'https://acme.com/a?ref=1',
                    ],
                },
            ],
        ]);
    });

    it('finds no variants under one path with different bodies, or where a variant names the clean URL as canonical', () => {
        expect(
            checks([
                row('/a', { body_hash: 'one' }),
                row('/a?page=2', { body_hash: 'two' }),
                row('/b'),
                row('/b?utm_source=x', {
                    body_hash: 'hash of /b',
                    canonical_url: 'https://acme.com/b',
                    in_sitemap: false,
                }),
            ]),
        ).toEqual([]);
    });

    it('notes indexable pages whose SimHashes differ in 6 bits or fewer, with different body hashes and no canonical between them', () => {
        const rows = [
            row('/warsaw', { body_simhash: '0000000000000000' }),
            row('/krakow', { body_simhash: '000000000000003f' }),
            row('/gdansk', { body_simhash: '000000000000007f' }),
            row('/same', {
                body_hash: 'hash of /warsaw',
                body_simhash: '0000000000000000',
            }),
            row('/print', {
                body_simhash: '8000000000000000',
                canonical_url: 'https://acme.com/warsaw',
            }),
            row('/short', { body_simhash: null }),
            row('/hidden', {
                body_simhash: '0000000000000000',
                is_indexable: false,
            }),
        ];

        expect(
            siteChecks(rows, context)
                .filter(({ check }) => check === 'near-duplicate')
                .map(({ url, subject, detail }) => [url, subject, detail]),
        ).toEqual([
            [
                'https://acme.com/gdansk',
                'https://acme.com/krakow',
                { duplicates: ['https://acme.com/krakow'] },
            ],
            [
                'https://acme.com/krakow',
                'https://acme.com/gdansk',
                {
                    duplicates: [
                        'https://acme.com/gdansk',
                        'https://acme.com/same',
                        'https://acme.com/warsaw',
                    ],
                },
            ],
            [
                'https://acme.com/print',
                'https://acme.com/same',
                { duplicates: ['https://acme.com/same'] },
            ],
            [
                'https://acme.com/same',
                'https://acme.com/krakow',
                {
                    duplicates: [
                        'https://acme.com/krakow',
                        'https://acme.com/print',
                    ],
                },
            ],
            [
                'https://acme.com/warsaw',
                'https://acme.com/krakow',
                { duplicates: ['https://acme.com/krakow'] },
            ],
        ]);
    });

    it(`reports every indexable, self-canonical URL of a facet path once ${facetVolume} of them share it`, () => {
        const facets = (count: number, path = '/shoes') =>
            Array.from({ length: count }, (_, i) => row(`${path}?color=c${i}`));

        const findings = siteChecks(
            [
                ...facets(facetVolume),
                ...facets(facetVolume - 1, '/bags'),
                row('/hats?sort=a', { canonical_url: 'https://acme.com/hats' }),
                ...facets(facetVolume - 1, '/hats'),
            ],
            context,
        ).filter(({ check }) => check === 'facets-indexable');

        expect(findings).toHaveLength(facetVolume);

        expect(findings[0]).toEqual({
            check: 'facets-indexable',
            url: 'https://acme.com/shoes?color=c0',
            subject: 'https://acme.com/shoes',
            detail: {
                reason: 'volume',
                path: 'https://acme.com/shoes',
                count: facetVolume,
            },
        });
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
                {
                    value: 'same',
                    duplicates: ['https://acme.com/b', 'https://acme.com/c'],
                },
            ],
            [
                'https://acme.com/b',
                'https://acme.com/a',
                {
                    value: 'same',
                    duplicates: ['https://acme.com/a', 'https://acme.com/c'],
                },
            ],
            [
                'https://acme.com/c',
                'https://acme.com/a',
                {
                    value: 'same',
                    duplicates: ['https://acme.com/a', 'https://acme.com/b'],
                },
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

    it('reports indexable pages that share a title or a description, whitespace aside, unless one names the other as canonical', () => {
        const rows = [
            row('/a', { title: 'Pricing  | Acme', description: 'Plans.' }),
            row('/b', { title: ' Pricing | Acme', description: 'Plans.' }),
            row('/c', { title: 'Pricing | Acme', is_indexable: false }),
            row('/print', {
                title: 'Story | Acme',
                canonical_url: 'https://acme.com/story',
            }),
            row('/story', { title: 'Story | Acme' }),
            row('/d', { title: null, description: '' }),
            row('/e', { title: null, description: null }),
        ];

        expect(
            siteChecks(rows, context).filter(({ check }) =>
                check.endsWith('-duplicate'),
            ),
        ).toEqual([
            {
                check: 'title-duplicate',
                url: 'https://acme.com/a',
                subject: 'https://acme.com/b',
                detail: {
                    value: 'Pricing | Acme',
                    duplicates: ['https://acme.com/b'],
                },
            },
            {
                check: 'title-duplicate',
                url: 'https://acme.com/b',
                subject: 'https://acme.com/a',
                detail: {
                    value: 'Pricing | Acme',
                    duplicates: ['https://acme.com/a'],
                },
            },
            {
                check: 'description-duplicate',
                url: 'https://acme.com/a',
                subject: 'https://acme.com/b',
                detail: {
                    value: 'Plans.',
                    duplicates: ['https://acme.com/b'],
                },
            },
            {
                check: 'description-duplicate',
                url: 'https://acme.com/b',
                subject: 'https://acme.com/a',
                detail: {
                    value: 'Plans.',
                    duplicates: ['https://acme.com/a'],
                },
            },
        ]);
    });

    it('lists at most 10 twins of a duplicate title', () => {
        const rows = Array.from({ length: 12 }, (_, index) =>
            row(`/p${String(index).padStart(2, '0')}`, { title: 'Same' }),
        );

        const [first] = siteChecks(rows, context).filter(
            ({ check }) => check === 'title-duplicate',
        );

        expect(
            (first.detail as { duplicates: string[] }).duplicates,
        ).toHaveLength(10);
    });

    it('lists each page of a large group with at most 10 twins, the first in sorted order, never itself', () => {
        const paths = Array.from(
            { length: 30 },
            (_, index) => `/p${String(29 - index).padStart(2, '0')}`,
        );

        const findings = siteChecks(
            paths.map((path) => row(path, { title: 'Same' })),
            context,
        ).filter(({ check }) => check === 'title-duplicate');

        expect(findings).toHaveLength(30);

        for (const { url, subject, detail } of findings) {
            const { duplicates } = detail as { duplicates: string[] };

            const expected = paths
                .map((path) => `https://acme.com${path}`)
                .filter((other) => other !== url)
                .sort()
                .slice(0, 10);

            expect(duplicates).toEqual(expected);
            expect(subject).toBe(expected[0]);
        }
    });

    it('finds no shared or boilerplate title or description on a site of one page', () => {
        expect(
            checks([
                row('/', {
                    title: 'Acme',
                    description: 'Plans.',
                    jsonld_count: 1,
                }),
            ]),
        ).toEqual([]);

        expect(
            checks([
                row('/pricing', {
                    title: 'Pricing | Acme',
                    description: 'Plans.',
                }),
            ]),
        ).toEqual([]);
    });

    it('reports a title that is only the site name off the home page, or a stock word once the site name is removed', () => {
        const titled = (path: string, title: string) => row(path, { title });

        const findings = siteChecks(
            [
                titled('/', 'Acme'),
                titled('/pricing', 'Pricing | Acme'),
                titled('/blog', 'Acme \u2013 Blog'),
                titled('/about', 'Acme'),
                titled('/start', 'Home - Acme'),
                titled('/draft', 'Untitled'),
                titled('/team', 'Team: Acme'),
            ],
            context,
        ).filter(({ check }) => check === 'title-boilerplate');

        expect(findings).toEqual([
            {
                check: 'title-boilerplate',
                url: 'https://acme.com/about',
                detail: { title: 'Acme', siteName: 'acme' },
            },
            {
                check: 'title-boilerplate',
                url: 'https://acme.com/start',
                detail: { title: 'Home - Acme', siteName: 'acme' },
            },
            {
                check: 'title-boilerplate',
                url: 'https://acme.com/draft',
                detail: { title: 'Untitled', siteName: 'acme' },
            },
        ]);
    });

    it('finds no site name in fewer than 2 titles, and still notes a stock word', () => {
        expect(
            siteChecks(
                [
                    row('/', { title: 'Welcome' }),
                    row('/a', { title: 'Pricing | Acme' }),
                    row('/b', { title: 'Acme' }),
                ],
                context,
            ).filter(({ check }) => check === 'title-boilerplate'),
        ).toEqual([
            {
                check: 'title-boilerplate',
                url: 'https://acme.com/',
                detail: { title: 'Welcome', siteName: null },
            },
        ]);
    });
});

describe('siteChecks, for structured data', () => {
    const format = (rows: SiteRow[]) =>
        siteChecks(rows, {
            ...context,
            homes: ['https://acme.com/', 'https://acme.com/de/'],
        }).filter(({ check }) => check === 'structured-data-format');

    it('hints at structured data on each indexable home page when no indexable page has JSON-LD, microdata or RDFa', () => {
        expect(
            format([
                row('/'),
                row('/de/'),
                row('/a'),
                row('/b', { is_indexable: false, jsonld_count: 2 }),
            ]),
        ).toEqual(
            ['https://acme.com/', 'https://acme.com/de/'].map((url) => ({
                check: 'structured-data-format',
                url,
                detail: { reason: 'none' },
            })),
        );

        expect(format([row('/', { is_indexable: false }), row('/a')])).toEqual(
            [],
        );
    });

    it('stays silent when one indexable page has a JSON-LD block or microdata', () => {
        expect(format([row('/'), row('/a', { jsonld_count: 1 })])).toEqual([]);

        expect(format([row('/'), row('/a', { has_microdata: true })])).toEqual(
            [],
        );
    });
});

describe('siteChecks, for the links', () => {
    const only = (rows: SiteRow[], names: string[], linkedFrom = new Map()) =>
        siteChecks(rows, { ...context, linkedFrom }).filter(({ check }) =>
            names.includes(check),
        );

    it('calls an indexable page in a sitemap that no page links to an orphan, never a home page', () => {
        expect(
            only(
                [
                    row('/', { inbound_links: 0, click_depth: 0 }),
                    row('/lone', { inbound_links: 0, click_depth: null }),
                    row('/hidden', {
                        inbound_links: 0,
                        click_depth: null,
                        in_sitemap: false,
                    }),
                    row('/noindex', {
                        inbound_links: 0,
                        click_depth: null,
                        is_indexable: false,
                    }),
                ],
                ['orphan', 'link-depth'],
            ),
        ).toEqual([
            {
                check: 'orphan',
                url: 'https://acme.com/lone',
                detail: { inbound: 0, depth: null },
            },
        ]);
    });

    it(`notes a page with one inbound link or ${deepClicks} clicks or more from a home page`, () => {
        expect(
            only(
                [
                    row('/', { inbound_links: 1, click_depth: 0 }),
                    row('/one', { inbound_links: 1, click_depth: 1 }),
                    row('/deep', { inbound_links: 3, click_depth: deepClicks }),
                    row('/near', {
                        inbound_links: 3,
                        click_depth: deepClicks - 1,
                    }),
                ],
                ['orphan', 'link-depth'],
            ).map(({ check, url }) => [check, url]),
        ).toEqual([
            ['link-depth', 'https://acme.com/one'],
            ['link-depth', 'https://acme.com/deep'],
        ]);
    });

    it('puts a broken or redirected link on each page recorded as linking to it, with the count of every linking page', () => {
        const linking = ['https://acme.com/a', 'https://acme.com/b'];

        expect(
            only(
                [
                    row('/gone', {
                        status_code: 404,
                        is_indexable: false,
                        inbound_links: 9,
                    }),
                    row('/moved', {
                        status_code: 301,
                        redirect_to: 'https://acme.com/new',
                        is_indexable: false,
                        canonical_url: null,
                    }),
                    row('/copy', { canonical_url: 'https://acme.com/main' }),
                    row('/fine'),
                ],
                ['link-broken-internal', 'link-to-redirect'],
                new Map(
                    ['/gone', '/moved', '/copy', '/fine'].map((path) => [
                        `https://acme.com${path}`,
                        path === '/gone' ? linking : linking.slice(0, 1),
                    ]),
                ),
            ),
        ).toEqual([
            ...linking.map((url) => ({
                check: 'link-broken-internal',
                url,
                subject: 'https://acme.com/gone',
                detail: { status: 404, linkCount: 9 },
            })),
            {
                check: 'link-to-redirect',
                url: linking[0],
                subject: 'https://acme.com/moved',
                detail: {
                    reason: 'redirect',
                    target: 'https://acme.com/new',
                    linkCount: 2,
                },
            },
            {
                check: 'link-to-redirect',
                url: linking[0],
                subject: 'https://acme.com/copy',
                detail: {
                    reason: 'canonical',
                    target: 'https://acme.com/main',
                    linkCount: 2,
                },
            },
        ]);
    });
});

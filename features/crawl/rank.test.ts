import { describe, expect, it } from 'vitest';

import { postSample, rankUrls } from '@/features/crawl/rank';

const home = 'https://www.acme.com/';

function rank(
    candidates: string[],
    extra: Partial<Parameters<typeof rankUrls>[0]> = {},
    count = 50,
) {
    return rankUrls(
        {
            home,
            candidates,
            navLinks: [],
            localePrefixes: [],
            seen: [],
            ...extra,
        },
        count,
    );
}

describe('rankUrls', () => {
    it('puts home first, then the navigation links, then pages that carry facts, then the rest', () => {
        expect(
            rank(
                [
                    'https://www.acme.com/blog/why-invoices',
                    'https://www.acme.com/integrations/stripe',
                    'https://www.acme.com/cennik',
                    'https://www.acme.com/features',
                    'https://www.acme.com/something',
                    'https://www.acme.com/',
                ],
                { navLinks: ['https://www.acme.com/features'] },
            ),
        ).toEqual([
            'https://www.acme.com/',
            'https://www.acme.com/features',
            'https://www.acme.com/cennik',
            'https://www.acme.com/integrations/stripe',
            'https://www.acme.com/something',
            'https://www.acme.com/blog/why-invoices',
        ]);
    });

    it('keeps the same site only on the home host, drops repeats, fragments and query strings', () => {
        expect(
            rank([
                'https://acme.com/about#team',
                'https://www.acme.com/about?utm_source=x',
                '/about',
                'https://other.com/about',
                'mailto:hi@acme.com',
            ]),
        ).toEqual([home, 'https://www.acme.com/about']);
    });

    it('drops archives, pagination, account pages and files', () => {
        expect(
            rank([
                'https://www.acme.com/tag/news',
                'https://www.acme.com/category/tips',
                'https://www.acme.com/blog/page/2',
                'https://www.acme.com/author/jane',
                'https://www.acme.com/login',
                'https://www.acme.com/brochure.pdf',
                'https://www.acme.com/logo.svg',
                'https://www.acme.com/wp-json/wp/v2',
                'https://www.acme.com/pricing',
            ]),
        ).toEqual([home, 'https://www.acme.com/pricing']);
    });

    it('samples a few blog posts and leaves the rest', () => {
        const posts = Array.from(
            { length: 20 },
            (_, i) => `https://www.acme.com/blog/post-${i}`,
        );

        const picked = rank([...posts, 'https://www.acme.com/contact']);

        expect(picked).toHaveLength(2 + postSample);
        expect(picked[1]).toBe('https://www.acme.com/contact');

        expect(rank(posts, { seen: posts.slice(0, postSample) })).toEqual([
            home,
        ]);
    });

    it('leaves pages of another locale out, its home included', () => {
        expect(
            rank(
                [
                    'https://www.acme.com/pl/cennik',
                    'https://www.acme.com/pl/',
                    'https://www.acme.com/pl',
                    'https://www.acme.com/plans',
                    'https://www.acme.com/docs/start',
                ],
                {
                    navLinks: ['https://www.acme.com/pl'],
                    localePrefixes: ['https://www.acme.com/pl'],
                },
            ),
        ).toEqual([
            home,
            'https://www.acme.com/plans',
            'https://www.acme.com/docs/start',
        ]);
    });

    it('skips pages already read and stops at the count', () => {
        const urls = Array.from(
            { length: 60 },
            (_, i) => `https://www.acme.com/p${i}`,
        );

        expect(rank(urls)).toHaveLength(50);

        expect(
            rank(urls, { seen: [home, 'https://www.acme.com/p0'] }, 2),
        ).toEqual(['https://www.acme.com/p1', 'https://www.acme.com/p2']);
    });

    it('ranks a path it cannot decode instead of failing', () => {
        expect(rank(['https://www.acme.com/%zz'])).toEqual([
            home,
            'https://www.acme.com/%zz',
        ]);
    });

    it('matches fact pages whatever the language, with accents and in compound slugs', () => {
        expect(
            rank([
                'https://www.acme.com/o-nas',
                'https://www.acme.com/über-uns',
                'https://www.acme.com/contact-us',
                'https://www.acme.com/zupa',
            ]),
        ).toEqual([
            home,
            'https://www.acme.com/o-nas',
            'https://www.acme.com/contact-us',
            'https://www.acme.com/%C3%BCber-uns',
            'https://www.acme.com/zupa',
        ]);
    });
});

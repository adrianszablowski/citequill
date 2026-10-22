import { describe, expect, it } from 'vitest';

import {
    type PublishCandidate,
    publishCheck,
} from '@/features/publishing/check';

const locales = [{ locale: 'pl', base_url: 'https://acme.com/pl' }];

function candidate(change: Partial<PublishCandidate> = {}): PublishCandidate {
    return {
        locale: 'pl',
        slug: 'deload',
        author_id: 'author',
        page_kinds: { url_prefix: '/blog', author_id: null },
        published_pages: null,
        ...change,
    };
}

describe('publishCheck', () => {
    it("gives a first publication the page's path and URL", () => {
        expect(publishCheck(candidate(), locales)).toEqual({
            address: {
                path: '/pl/blog/deload',
                url: 'https://acme.com/pl/blog/deload',
            },
        });
    });

    it("takes the kind's author when the page has none of its own", () => {
        const page = candidate({
            author_id: null,
            page_kinds: { url_prefix: '/blog', author_id: 'kind-author' },
        });

        expect(publishCheck(page, locales)).toHaveProperty('address');
    });

    it('refuses a page with no author, and says what to fill in', () => {
        const page = candidate({
            author_id: null,
            page_kinds: { url_prefix: '/blog', author_id: null },
        });

        expect(publishCheck(page, locales)).toEqual({
            error: "Pick the page's author in Edit, then publish it.",
        });
    });

    it('lets a page published before go out again at the address it went live at', () => {
        const page = candidate({
            published_pages: { url: 'https://acme.com/pl/blog/deload' },
        });

        expect(publishCheck(page, locales)).toHaveProperty('address');
    });

    it('refuses a page whose computed path moved since it went live, and names both addresses', () => {
        const page = candidate({
            published_pages: { url: 'https://acme.com/blog/deload' },
        });

        expect(publishCheck(page, locales).error).toContain(
            'The page went live at https://acme.com/blog/deload, and the base URL of its language and the URL prefix of its kind now give https://acme.com/pl/blog/deload.',
        );
    });

    it('refuses a page whose host moved and whose path did not, because the old address needs a redirect too', () => {
        const page = candidate({
            published_pages: { url: 'https://www.acme.com/pl/blog/deload' },
        });

        expect(publishCheck(page, locales).error).toContain(
            'The page went live at https://www.acme.com/pl/blog/deload,',
        );
    });

    it('refuses a page in a language the project no longer has', () => {
        expect(publishCheck(candidate({ locale: 'de' }), locales).error).toBe(
            "The page is in de, which is not among the project's languages, so it has no address on the site. Write it again in one of the project's languages.",
        );
    });
});

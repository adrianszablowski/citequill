import { describe, expect, it } from 'vitest';

import {
    alternatesOf,
    pageObject,
    publisherOf,
    removalRecord,
    sitemapItem,
} from '@/features/content-api/page-object';
import type { SiteRow, VersionRow } from '@/features/content-api/rows';

const site: SiteRow = {
    project_name: 'Acme',
    organization_name: null,
    organization_url: null,
    organization_logo_url: null,
    organization_logo_width: null,
    organization_logo_height: null,
    organization_same_as: [],
    locales: [
        { locale: 'en-US', base_url: 'https://acme.com', is_default: true },
        { locale: 'pl', base_url: 'https://acme.com/pl', is_default: false },
    ],
};

const row: VersionRow = {
    id: 'page',
    status: 'published',
    published_at: '2026-10-01T08:00:00.123456+00:00',
    unpublished_at: null,
    redirect_to: null,
    kind: 'Blog',
    kind_url_prefix: '/blog',
    locale: 'pl',
    locale_base_url: 'https://acme.com/pl',
    slug: 'deload',
    path: '/pl/blog/deload',
    url: 'https://acme.com/pl/blog/deload',
    title: 'Deload',
    meta_title: 'Deload week | Acme',
    meta_description: 'When to rest.',
    excerpt: 'A week of rest.',
    body_md: '# Rest\n\nA week.<br>',
    body_html: '<h2 id="rest">Rest</h2><p>A week.</p>',
    toc: [{ id: 'rest', text: 'Rest', level: 2 }],
    word_count: 3,
    reading_minutes: 1,
    faq: [{ question: 'How long?', answer: 'A week.' }],
    sources: [{ title: 'A study', url: 'https://example.org/study' }],
    tags: ['training', 'rest'],
    author_name: 'Jane Kowalska',
    author_title: 'Head coach',
    author_url: 'https://acme.com/team/jane',
    author_same_as: ['https://www.linkedin.com/in/jane'],
    modified_at: '2026-10-02T09:30:00+00:00',
    updated_at: '2026-10-03T10:00:00+00:00',
    alternates: [
        {
            locale: 'en-US',
            url: 'https://acme.com/blog/deload',
            is_default: true,
        },
        {
            locale: 'pl',
            url: 'https://acme.com/pl/blog/deload',
            is_default: false,
        },
    ],
};

const publisher = publisherOf(site);

describe('publisherOf', () => {
    it("falls back to the project's name and the main locale's origin, with no logo", () => {
        expect(publisher).toEqual({
            name: 'Acme',
            url: 'https://acme.com',
            logo: null,
            sameAs: [],
        });
    });

    it("keeps the organization's own values and its logo", () => {
        expect(
            publisherOf({
                ...site,
                organization_name: 'Acme Inc.',
                organization_url: 'https://www.acme.com',
                organization_logo_url: 'https://acme.com/logo.png',
                organization_logo_width: 600,
                organization_logo_height: 60,
                organization_same_as: ['https://x.com/acme'],
            }),
        ).toEqual({
            name: 'Acme Inc.',
            url: 'https://www.acme.com',
            logo: { url: 'https://acme.com/logo.png', width: 600, height: 60 },
            sameAs: ['https://x.com/acme'],
        });
    });
});

describe('pageObject', () => {
    const page = pageObject(row, publisher);

    it('writes the locale as hreflang and its Open Graph form', () => {
        expect(page).toMatchObject({
            status: 'published',
            locale: 'pl',
            hreflang: 'pl',
            ogLocale: 'pl',
            canonical: row.url,
        });

        expect(
            pageObject({ ...row, locale: 'en-US' }, publisher).ogLocale,
        ).toBe('en_US');
    });

    it('lists every live version and x-default for the main locale', () => {
        expect(page.alternates).toEqual([
            { hreflang: 'en-US', url: 'https://acme.com/blog/deload' },
            { hreflang: 'pl', url: 'https://acme.com/pl/blog/deload' },
            { hreflang: 'x-default', url: 'https://acme.com/blog/deload' },
        ]);
    });

    it('cleans the markdown and keeps the HTML as published', () => {
        expect(page.body).toEqual({
            markdown: '## Rest\n\nA week.\n',
            html: row.body_html,
        });
    });

    it('dates the content by its last change and writes dates in one format', () => {
        expect(page.publishedAt).toBe('2026-10-01T08:00:00.123Z');
        expect(page.updatedAt).toBe('2026-10-02T09:30:00.000Z');
        expect(page.openGraph.modifiedTime).toBe('2026-10-02T09:30:00.000Z');
    });

    it('builds the breadcrumbs from the home, the kind and the page', () => {
        expect(page.breadcrumbs).toEqual([
            { name: 'Acme', url: 'https://acme.com/pl' },
            { name: 'Blog', url: 'https://acme.com/pl/blog' },
            { name: 'Deload', url: 'https://acme.com/pl/blog/deload' },
        ]);
    });

    it('leaves the kind out of the breadcrumbs when it has no prefix', () => {
        expect(
            pageObject({ ...row, kind_url_prefix: '/' }, publisher).breadcrumbs,
        ).toHaveLength(2);
    });

    it('gives the first tag as the primary one', () => {
        expect(page.primaryTag).toBe('training');

        expect(pageObject({ ...row, tags: [] }, publisher).primaryTag).toBe(
            null,
        );
    });

    it('writes an Article with its author, publisher and the BreadcrumbList', () => {
        expect(page.jsonLd).toEqual({
            '@context': 'https://schema.org',
            '@graph': [
                {
                    '@type': 'Article',
                    headline: 'Deload',
                    description: 'When to rest.',
                    datePublished: '2026-10-01T08:00:00.123Z',
                    dateModified: '2026-10-02T09:30:00.000Z',
                    inLanguage: 'pl',
                    mainEntityOfPage: 'https://acme.com/pl/blog/deload',
                    author: {
                        '@type': 'Person',
                        name: 'Jane Kowalska',
                        jobTitle: 'Head coach',
                        url: 'https://acme.com/team/jane',
                        sameAs: ['https://www.linkedin.com/in/jane'],
                    },
                    publisher: {
                        '@type': 'Organization',
                        name: 'Acme',
                        url: 'https://acme.com',
                    },
                },
                {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        {
                            '@type': 'ListItem',
                            position: 1,
                            name: 'Acme',
                            item: 'https://acme.com/pl',
                        },
                        {
                            '@type': 'ListItem',
                            position: 2,
                            name: 'Blog',
                            item: 'https://acme.com/pl/blog',
                        },
                        {
                            '@type': 'ListItem',
                            position: 3,
                            name: 'Deload',
                            item: 'https://acme.com/pl/blog/deload',
                        },
                    ],
                },
            ],
        });
    });

    it("gives the publisher's logo as an ImageObject when it has one", () => {
        const withLogo = pageObject(row, {
            ...publisher,
            logo: { url: 'https://acme.com/logo.png', width: 600, height: 60 },
        });

        expect(withLogo.jsonLd['@graph'][0]).toMatchObject({
            publisher: {
                logo: {
                    '@type': 'ImageObject',
                    url: 'https://acme.com/logo.png',
                    width: 600,
                    height: 60,
                },
            },
        });
    });

    it('has no image and no FAQPage in the JSON-LD', () => {
        const json = JSON.stringify(page.jsonLd);

        expect(json).not.toContain('FAQPage');
        expect(json).not.toContain('"image"');
    });
});

describe('removalRecord', () => {
    it('gives a 301 with its target, or null for a 410', () => {
        const gone = {
            id: 'page',
            locale: 'pl',
            path: '/pl/blog/deload',
            url: 'https://acme.com/pl/blog/deload',
            unpublished_at: '2026-10-05T12:00:00+00:00',
            redirect_to: 'https://acme.com/pl/pricing',
        };

        expect(removalRecord(gone)).toEqual({
            id: 'page',
            locale: 'pl',
            path: '/pl/blog/deload',
            url: 'https://acme.com/pl/blog/deload',
            status: 'unpublished',
            unpublishedAt: '2026-10-05T12:00:00.000Z',
            redirect: { status: 301, to: 'https://acme.com/pl/pricing' },
        });

        expect(removalRecord({ ...gone, redirect_to: null }).redirect).toBe(
            null,
        );
    });
});

describe('sitemapItem', () => {
    it('dates a URL by its content and lists its alternates', () => {
        expect(sitemapItem(row)).toEqual({
            url: row.url,
            lastmod: '2026-10-02T09:30:00.000Z',
            alternates: alternatesOf(row.alternates),
        });
    });
});

describe('alternatesOf', () => {
    it('has no x-default when the main locale has no live version', () => {
        expect(alternatesOf([row.alternates[1]])).toEqual([
            { hreflang: 'pl', url: 'https://acme.com/pl/blog/deload' },
        ]);
    });
});

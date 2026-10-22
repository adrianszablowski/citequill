import { describe, expect, it } from 'vitest';

import { pageSchema, pageValues } from '@/features/pages/schema';

const stored = {
    title: 'Deload week',
    slug: 'deload-week',
    meta_title: 'Deload week, explained',
    meta_description: 'What a deload week is.',
    excerpt: 'A week of lighter training.',
    body_md: 'Rest.',
    faq: [{ question: 'How long?', answer: 'A week.' }],
    sources: 'not a list',
    tags: ['recovery'],
    author_id: null,
};

describe('pageValues', () => {
    it("shows the kind's author when the page has none of its own", () => {
        expect(pageValues(stored, 'kind-author').author_id).toBe('kind-author');

        expect(
            pageValues({ ...stored, author_id: 'own' }, 'kind-author')
                .author_id,
        ).toBe('own');
    });

    it('reads the stored FAQ and sources as lists, and an unreadable one as empty', () => {
        const values = pageValues(stored, null);

        expect(values.faq).toEqual(stored.faq);
        expect(values.sources).toEqual([]);
    });
});

describe('pageSchema', () => {
    const values = pageValues(stored, null);

    it('drops empty tags and trims the rest', () => {
        const parsed = pageSchema.parse({
            ...values,
            tags: ['protein', ' strength training ', ''],
        });

        expect(parsed.tags).toEqual(['protein', 'strength training']);
    });

    it('takes a slug of lowercase letters, digits and single hyphens only', () => {
        for (const slug of [
            'Deload',
            'deload--week',
            'deload week',
            '-x',
            'x-',
            'zażółć',
        ]) {
            expect(pageSchema.safeParse({ ...values, slug }).success).toBe(
                false,
            );
        }

        expect(
            pageSchema.safeParse({ ...values, slug: 'deload-week-2' }).success,
        ).toBe(true);
    });

    it('takes a source over https or http, and names both when it refuses one', () => {
        for (const url of ['https://example.org/a', 'http://example.org/a']) {
            expect(
                pageSchema.safeParse({
                    ...values,
                    sources: [{ title: 'A study', url }],
                }).success,
            ).toBe(true);
        }

        expect(
            pageSchema.safeParse({
                ...values,
                sources: [{ title: 'A study', url: 'example.org' }],
            }).error?.issues[0].message,
        ).toBe('Give the full address, starting with https:// or http://.');
    });

    it('refuses a source without a web address and a question without an answer', () => {
        expect(
            pageSchema.safeParse({
                ...values,
                sources: [{ title: 'A study', url: 'javascript:alert(1)' }],
            }).success,
        ).toBe(false);

        expect(
            pageSchema.safeParse({
                ...values,
                faq: [{ question: 'How long?', answer: ' ' }],
            }).success,
        ).toBe(false);
    });
});

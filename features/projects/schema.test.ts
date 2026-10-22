import { describe, expect, it } from 'vitest';

import {
    authorSchema,
    authorValues,
    kindAuthorsSchema,
    kindAuthorsValues,
    organizationSchema,
    organizationValues,
    projectSchema,
} from '@/features/projects/schema';

describe('projectSchema', () => {
    it('keeps the host of a full address, without www', () => {
        expect(
            projectSchema.parse({
                domain: 'https://www.yoursite.com/blog?x=1',
            }),
        ).toEqual({ domain: 'yoursite.com' });

        expect(projectSchema.parse({ domain: 'www.yoursite.com' })).toEqual({
            domain: 'yoursite.com',
        });
    });

    it('accepts a bare domain and folds it to lowercase', () => {
        expect(projectSchema.parse({ domain: ' Shop.Example.COM ' })).toEqual({
            domain: 'shop.example.com',
        });
    });

    it('rejects a host without a dot and an empty address', () => {
        expect(projectSchema.safeParse({ domain: 'localhost' }).success).toBe(
            false,
        );

        expect(projectSchema.safeParse({ domain: '' }).success).toBe(false);
    });

    it('rejects an address that is not a host', () => {
        expect(projectSchema.safeParse({ domain: 'not a site' }).success).toBe(
            false,
        );
    });
});

describe('organizationSchema', () => {
    it('reads the profiles one a line, trimmed, without blank lines or repeats', () => {
        expect(
            organizationSchema.parse({
                name: 'Acme',
                url: '',
                logo_url: '',
                same_as:
                    ' https://x.com/acme \n\nhttps://github.com/acme\nhttps://x.com/acme',
            }),
        ).toEqual({
            name: 'Acme',
            url: null,
            logo_url: null,
            same_as: ['https://x.com/acme', 'https://github.com/acme'],
        });
    });

    it('names the line that is not a full address, on the profiles field', () => {
        const result = organizationSchema.safeParse({
            name: '',
            url: '',
            logo_url: '',
            same_as: 'https://x.com/acme\nlinkedin.com/company/acme',
        });

        expect(result.error?.issues).toEqual([
            expect.objectContaining({
                path: ['same_as'],
                message:
                    'Give linkedin.com/company/acme as a full address, starting with https:// or http://.',
            }),
        ]);
    });

    it('refuses a URL or a logo that is not a web address', () => {
        for (const field of ['url', 'logo_url']) {
            expect(
                organizationSchema.safeParse({
                    name: '',
                    url: '',
                    logo_url: '',
                    same_as: '',
                    [field]: 'acme.com',
                }).success,
                field,
            ).toBe(false);
        }
    });

    it('gives the form back the stored values, profiles one a line', () => {
        expect(
            organizationValues({
                organization_name: null,
                organization_url: 'https://acme.com',
                organization_logo_url: null,
                organization_same_as: [
                    'https://x.com/acme',
                    'https://github.com/acme',
                ],
            }),
        ).toEqual({
            name: '',
            url: 'https://acme.com',
            logo_url: '',
            same_as: 'https://x.com/acme\nhttps://github.com/acme',
        });
    });
});

describe('authorSchema', () => {
    it('needs a name and stores an empty title and profile URL as empty', () => {
        expect(
            authorSchema.parse({
                name: ' Jane Doe ',
                title: ' ',
                url: '',
                same_as: '',
            }),
        ).toEqual({ name: 'Jane Doe', title: null, url: null, same_as: [] });

        expect(
            authorSchema.safeParse({
                name: '',
                title: '',
                url: '',
                same_as: '',
            }).error?.issues[0].message,
        ).toBe('Give the author a name.');
    });

    it('round-trips a stored author through the form', () => {
        const author = {
            name: 'Jane Doe',
            title: 'Head coach',
            url: 'https://acme.com/team/jane',
            same_as: ['https://x.com/jane'],
        };

        expect(authorSchema.parse(authorValues(author))).toEqual(author);
    });

    it('takes a name of 120 characters and refuses one of 121', () => {
        const author = {
            name: 'a'.repeat(120),
            title: '',
            url: '',
            same_as: '',
        };

        expect(authorSchema.safeParse(author).success).toBe(true);

        expect(
            authorSchema.safeParse({ ...author, name: 'a'.repeat(121) }).error
                ?.issues[0].message,
        ).toBe('Shorten the name to 120 characters or fewer.');
    });
});

describe('kindAuthorsSchema', () => {
    it('gives each kind its stored author, an empty one when it has none, and needs one to save', () => {
        const values = kindAuthorsValues([
            { id: 'guide', author_id: 'jane' },
            { id: 'comparison', author_id: null },
        ]);

        expect(values).toEqual({
            kinds: [
                { id: 'guide', author_id: 'jane' },
                { id: 'comparison', author_id: '' },
            ],
        });

        expect(
            kindAuthorsSchema.safeParse(values).error?.issues[0],
        ).toMatchObject({
            path: ['kinds', 1, 'author_id'],
            message: 'Pick an author for the kind.',
        });
    });
});

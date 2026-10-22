import * as z from 'zod';

import { isWebUrl, webUrlError } from '@/lib/utils';

const domain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export const projectSchema = z.object({
    domain: z
        .string()
        .trim()
        .transform(toHost)
        .pipe(
            z
                .string()
                .regex(
                    domain,
                    'Enter the address of a site, like https://www.yoursite.com.',
                ),
        ),
});

export type ProjectValues = z.input<typeof projectSchema>;

const webAddress = z
    .string()
    .trim()
    .refine((value) => value === '' || isWebUrl(value), webUrlError);

export const organizationSchema = z.object({
    name: optional(
        z
            .string()
            .trim()
            .max(120, 'Shorten the name to 120 characters or fewer.'),
    ),
    url: optional(webAddress),
    logo_url: optional(webAddress),
    same_as: profiles(),
});

export type OrganizationValues = z.input<typeof organizationSchema>;

export function organizationValues(project: {
    organization_name: string | null;
    organization_url: string | null;
    organization_logo_url: string | null;
    organization_same_as: string[];
}): OrganizationValues {
    return {
        name: project.organization_name ?? '',
        url: project.organization_url ?? '',
        logo_url: project.organization_logo_url ?? '',
        same_as: project.organization_same_as.join('\n'),
    };
}

export const authorSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Give the author a name.')
        .max(120, 'Shorten the name to 120 characters or fewer.'),
    title: optional(
        z
            .string()
            .trim()
            .max(120, 'Shorten the title to 120 characters or fewer.'),
    ),
    url: optional(webAddress),
    same_as: profiles(),
});

export type AuthorValues = z.input<typeof authorSchema>;

export function authorValues(author: {
    name: string;
    title: string | null;
    url: string | null;
    same_as: string[];
}): AuthorValues {
    return {
        name: author.name,
        title: author.title ?? '',
        url: author.url ?? '',
        same_as: author.same_as.join('\n'),
    };
}

export const kindAuthorsSchema = z.object({
    kinds: z.array(
        z.object({
            id: z.string(),
            author_id: z.string().min(1, 'Pick an author for the kind.'),
        }),
    ),
});

export type KindAuthorsValues = z.infer<typeof kindAuthorsSchema>;

export function kindAuthorsValues(
    kinds: { id: string; author_id: string | null }[],
): KindAuthorsValues {
    return {
        kinds: kinds.map(({ id, author_id }) => ({
            id,
            author_id: author_id ?? '',
        })),
    };
}

export const foreignAuthorError = "Pick one of this project's authors.";

function optional(text: z.ZodType<string, string>) {
    return text.transform((value) => value || null);
}

function profiles() {
    return z
        .string()
        .transform((text) => [
            ...new Set(
                text
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
            ),
        ])
        .superRefine((lines, context) => {
            const address = lines.find((line) => !isWebUrl(line));

            if (address) {
                context.addIssue({
                    code: 'custom',
                    message: `Give ${address} as a full address, starting with https:// or http://.`,
                });
            }
        });
}

function toHost(address: string) {
    try {
        return new URL(
            /^[a-z]+:\/\//i.test(address) ? address : `https://${address}`,
        ).hostname.replace(/^www\./, '');
    } catch {
        return address.toLowerCase();
    }
}

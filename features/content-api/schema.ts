import * as z from 'zod';

export const keysPerProject = 10;

export const keyLimitSentence = `A project has up to ${keysPerProject} keys. Delete one to make another.`;

export const siteKeySchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Name the key, such as Production.')
        .max(60, 'Shorten the name to 60 characters or fewer.'),
});

export type SiteKeyValues = z.input<typeof siteKeySchema>;

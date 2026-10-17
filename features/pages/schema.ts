import * as z from 'zod';

export const writePageSchema = z.object({
    topic: z
        .string()
        .trim()
        .min(5, 'Say what the page is about, in a few words at least.')
        .max(300, 'Keep the topic under 300 characters.'),
    kind_id: z.string().min(1, 'Pick a kind.'),
    locale: z.string().min(2, 'Pick a language.'),
});

export type WritePageValues = z.infer<typeof writePageSchema>;

export const pageSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'Give the page a title.')
        .max(120, 'Keep the title under 120 characters.'),
    excerpt: z
        .string()
        .trim()
        .min(1, 'Give the page an excerpt for lists and link previews.')
        .max(300, 'Keep the excerpt under 300 characters.'),
    body_md: z.string().trim().min(1, 'The page needs a body.'),
});

export type PageValues = z.infer<typeof pageSchema>;

export const faqItems = z.array(
    z.object({ question: z.string(), answer: z.string() }),
);

export const sourceItems = z.array(
    z.object({ title: z.string(), url: z.string() }),
);


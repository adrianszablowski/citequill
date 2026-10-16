import * as z from 'zod';

export const skillSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'Give the skill a name.')
        .max(60, 'Keep the name under 60 characters.'),
    description: z
        .string()
        .trim()
        .max(200, 'Keep the description under 200 characters.'),
    body: z.string().trim().min(1, 'Write what the model should know.'),
});

export type SkillValues = z.infer<typeof skillSchema>;

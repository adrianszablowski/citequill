import * as z from 'zod';

import { isRedirectTarget } from '@/features/publishing/redirect';

export const unpublishSchema = z
    .object({
        answer: z.enum(['gone', 'redirect']),
        to: z.string().trim(),
    })
    .superRefine((values, context) => {
        if (values.answer === 'redirect' && !isRedirectTarget(values.to)) {
            context.addIssue({
                code: 'custom',
                path: ['to'],
                message: values.to
                    ? 'Give a path on the site that starts with /, or a full address that starts with https://.'
                    : 'Give the address to send visitors to.',
            });
        }
    });

export type UnpublishValues = z.infer<typeof unpublishSchema>;

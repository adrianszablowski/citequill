import * as z from 'zod';

import {
    areaWeights,
    catalogue,
    type CheckId,
    type Severity,
} from '@/features/audit/catalogue';
import { pageSizes } from '@/features/pages/schema';

export const findingViews = ['finding', 'page', 'image'] as const;

export const severities = [
    '3',
    '2',
    '1',
    'hint',
    'question',
] as const satisfies readonly Severity[];

export const severityColumns = {
    '3': 'severity_3',
    '2': 'severity_2',
    '1': 'severity_1',
    hint: 'hints',
    question: 'questions',
} as const;

export const checkSorts = ['severity', 'pages'] as const;

export const sitePageSorts = ['findings', 'url'] as const;

export const imageSorts = ['pages', 'subject'] as const;

type Sort =
    | (typeof checkSorts)[number]
    | (typeof sitePageSorts)[number]
    | (typeof imageSorts)[number];

const sorts = [
    ...new Set([...checkSorts, ...sitePageSorts, ...imageSorts]),
] as [Sort, ...Sort[]];

const optionalText = z.string().trim().min(1).optional().catch(undefined);

const checkId = z.enum(
    catalogue.map((check) => check.id) as [CheckId, ...CheckId[]],
);

export const findingListQuery = z.object({
    view: z.enum(findingViews).catch('finding'),
    check: checkId.optional().catch(undefined),
    site_page: z.uuid().optional().catch(undefined),
    subject: optionalText,
    severity: z.enum(severities).optional().catch(undefined),
    area: z
        .enum(Object.keys(areaWeights) as [keyof typeof areaWeights])
        .optional()
        .catch(undefined),
    locale: optionalText,
    written: z.enum(['yes', 'no']).optional().catch(undefined),
    q: optionalText,
    sort: z.enum(sorts).optional().catch(undefined),
    page: z.coerce.number().int().min(1).catch(1),
    size: z.coerce.number().pipe(z.literal(pageSizes)).catch(10),
});

export type FindingListQuery = z.infer<typeof findingListQuery>;

export const findingListDefaults = findingListQuery.parse({});

export const markSchema = z.object({
    check: checkId,
    url: z.string().nullable(),
    selector: z.string().nullable(),
});

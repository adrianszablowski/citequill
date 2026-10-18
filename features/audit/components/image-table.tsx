import Link from 'next/link';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { CheckId } from '@/features/audit/catalogue';
import FindingElement from '@/features/audit/components/finding-element';
import ImageThumbnail from '@/features/audit/components/image-thumbnail';
import SortHead from '@/features/audit/components/sort-head';
import { checkText } from '@/features/audit/check-texts';
import { altAsShown, ancestorAsShown } from '@/features/audit/format';
import {
    findingListHref,
    hasFindingFilters,
    imageSort,
} from '@/features/audit/list-query';
import type { ImageListItem } from '@/features/audit/queries';
import type { FindingListQuery } from '@/features/audit/schema';
import { formatCount } from '@/lib/utils';

interface ImageTableProps {
    projectId: string;
    rows: ImageListItem[];
    query: FindingListQuery;
}

export default function ImageTable({
    projectId,
    rows,
    query,
}: Readonly<ImageTableProps>) {
    if (rows.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {hasFindingFilters(query)
                    ? 'No images match these filters.'
                    : 'This audit found no image to fix.'}
            </p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <SortHead
                        href={findingListHref(projectId, {
                            ...query,
                            sort: 'subject',
                            page: 1,
                        })}
                        label="Image"
                        isActive={imageSort(query) === 'subject'}
                    />
                    <TableHead>Alt</TableHead>
                    <TableHead>Findings</TableHead>
                    <TableHead>Where</TableHead>
                    <SortHead
                        href={findingListHref(projectId, {
                            ...query,
                            sort: 'pages',
                            page: 1,
                        })}
                        label="Pages"
                        isActive={imageSort(query) === 'pages'}
                        className="text-right"
                    />
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={row.subject}>
                        <TableCell className="max-w-72 align-top whitespace-normal">
                            <div className="flex items-start gap-3">
                                <ImageThumbnail subject={row.subject} />
                                <span className="min-w-0 text-sm break-all">
                                    {row.subject}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="max-w-48 align-top whitespace-normal">
                            <ul className="flex flex-col gap-1 text-sm">
                                {row.alts.map((alt) => (
                                    <li key={alt} className="break-all">
                                        {altAsShown(alt)}
                                    </li>
                                ))}
                            </ul>
                        </TableCell>
                        <TableCell className="max-w-56 align-top whitespace-normal">
                            <ul className="flex flex-col gap-1 text-sm">
                                {row.checks.map((check) => (
                                    <li key={check}>
                                        {checkText(check as CheckId)?.name ??
                                            check}
                                    </li>
                                ))}
                            </ul>
                        </TableCell>
                        <TableCell className="max-w-80 align-top whitespace-normal">
                            <div className="flex flex-col gap-1">
                                {row.ancestors.map((ancestor) => (
                                    <p key={ancestor} className="text-sm">
                                        {ancestorAsShown(ancestor)}
                                    </p>
                                ))}
                                <FindingElement
                                    finding={{
                                        selector: row.selector,
                                        snippet: row.snippet,
                                    }}
                                />
                            </div>
                        </TableCell>
                        <TableCell className="text-right align-top">
                            <div className="flex flex-col items-end gap-1">
                                <Link
                                    href={findingListHref(projectId, {
                                        ...query,
                                        subject: row.subject,
                                        page: 1,
                                    })}
                                    className="font-medium hover:underline"
                                >
                                    {formatCount(row.pages)}
                                </Link>
                                {row.pages_intended > 0 && (
                                    <span className="text-sm text-muted-foreground">
                                        {formatCount(row.pages_intended)}{' '}
                                        intended
                                    </span>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

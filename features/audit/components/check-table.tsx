import Link from 'next/link';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    type CheckId,
    checkOf,
    type Severity,
} from '@/features/audit/catalogue';
import SeverityBadge from '@/features/audit/components/severity-badge';
import SortHead from '@/features/audit/components/sort-head';
import { areaNames, checkText } from '@/features/audit/check-texts';
import {
    checkSort,
    findingListHref,
    hasFindingFilters,
} from '@/features/audit/list-query';
import type { CheckListItem } from '@/features/audit/queries';
import type { FindingListQuery } from '@/features/audit/schema';
import { isSiteCheck } from '@/features/audit/score';
import { formatCount } from '@/lib/utils';

interface CheckTableProps {
    projectId: string;
    rows: CheckListItem[];
    query: FindingListQuery;
}

export default function CheckTable({
    projectId,
    rows,
    query,
}: Readonly<CheckTableProps>) {
    if (rows.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {hasFindingFilters(query)
                    ? 'No findings match these filters.'
                    : 'This audit found nothing to fix in the checks it ran.'}
            </p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Finding</TableHead>
                    <SortHead
                        href={findingListHref(projectId, {
                            ...query,
                            sort: 'severity',
                            page: 1,
                        })}
                        label="Severity"
                        isActive={checkSort(query) === 'severity'}
                    />
                    <TableHead>Area</TableHead>
                    <SortHead
                        href={findingListHref(projectId, {
                            ...query,
                            sort: 'pages',
                            page: 1,
                        })}
                        label="Pages"
                        isActive={checkSort(query) === 'pages'}
                        className="text-right"
                    />
                    <TableHead className="text-right">Intended</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => {
                    const check = row.check as CheckId;

                    return (
                        <TableRow key={check}>
                            <TableCell className="font-medium whitespace-normal">
                                <Link
                                    href={findingListHref(projectId, {
                                        ...query,
                                        check,
                                        page: 1,
                                    })}
                                    className="hover:underline"
                                >
                                    {checkText(check)?.name ?? check}
                                </Link>
                            </TableCell>
                            <TableCell>
                                <SeverityBadge
                                    severity={row.severity as Severity}
                                />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {areaNames[checkOf(check)?.area]}
                            </TableCell>
                            <TableCell className="text-right">
                                {isSiteCheck(check)
                                    ? 'Site'
                                    : formatCount(row.pages_failed)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {formatCount(row.pages_intended)}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

import { ArrowDownIcon, ChevronsUpDownIcon } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { severityNames } from '@/features/audit/check-texts';
import {
    findingListHref,
    hasFindingFilters,
    sitePageSort,
} from '@/features/audit/list-query';
import type { SitePageListItem } from '@/features/audit/queries';
import {
    type FindingListQuery,
    severities,
    severityColumns,
    type sitePageSorts,
} from '@/features/audit/schema';
import { formatCount } from '@/lib/utils';

interface SitePageTableProps {
    projectId: string;
    rows: SitePageListItem[];
    query: FindingListQuery;
}

export default function SitePageTable({
    projectId,
    rows,
    query,
}: Readonly<SitePageTableProps>) {
    if (rows.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {hasFindingFilters(query)
                    ? 'No pages match these filters.'
                    : 'This audit found nothing to fix on any page.'}
            </p>
        );
    }

    function canonicalOf(row: SitePageListItem) {
        if (!row.canonical_url) {
            return 'None';
        }

        return row.canonical_url === row.url ? 'Itself' : row.canonical_url;
    }

    function sortHead(sort: Sort, label: string, className?: string) {
        const isActive = sitePageSort(query) === sort;
        const Icon = isActive ? ArrowDownIcon : ChevronsUpDownIcon;

        return (
            <TableHead className={className}>
                <Link
                    href={findingListHref(projectId, {
                        ...query,
                        sort,
                        page: 1,
                    })}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                >
                    {label}
                    <Icon
                        className={
                            isActive
                                ? 'size-3.5'
                                : 'size-3.5 text-muted-foreground'
                        }
                    />
                </Link>
            </TableHead>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {sortHead('url', 'Page')}
                    <TableHead>Status</TableHead>
                    <TableHead>Canonical</TableHead>
                    <TableHead>Title</TableHead>
                    {sortHead('findings', 'Findings')}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={row.id}>
                        <TableCell className="max-w-80 font-medium break-all whitespace-normal">
                            <div className="flex flex-col items-start gap-1">
                                <Link
                                    href={findingListHref(projectId, {
                                        ...query,
                                        site_page: row.id,
                                        page: 1,
                                    })}
                                    className="hover:underline"
                                >
                                    {row.url}
                                </Link>
                                {row.page_id && (
                                    <Badge variant="secondary">
                                        Written by Citequill
                                    </Badge>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>{row.status_code ?? 'No answer'}</TableCell>
                        <TableCell className="max-w-64 break-all whitespace-normal text-muted-foreground">
                            {canonicalOf(row)}
                        </TableCell>
                        <TableCell className="max-w-64 whitespace-normal text-muted-foreground">
                            {row.title}
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-wrap gap-1">
                                {row.findings === 0 && (
                                    <Badge variant="outline">
                                        All intended
                                    </Badge>
                                )}
                                {severities
                                    .filter(
                                        (severity) =>
                                            row[severityColumns[severity]] > 0,
                                    )
                                    .map((severity) => (
                                        <Badge key={severity} variant="outline">
                                            {formatCount(
                                                row[severityColumns[severity]],
                                            )}{' '}
                                            {severityNames[severity]}
                                        </Badge>
                                    ))}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

type Sort = (typeof sitePageSorts)[number];

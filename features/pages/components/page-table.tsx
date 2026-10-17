import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
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
import { hasFilters, pageListHref } from '@/features/pages/list-query';
import type { PageListItem } from '@/features/pages/queries';
import type { PageListQuery, pageSorts } from '@/features/pages/schema';
import { pageHref } from '@/lib/sections';

interface PageTableProps {
    projectId: string;
    pages: PageListItem[];
    query: PageListQuery;
}

export default function PageTable({
    projectId,
    pages,
    query,
}: Readonly<PageTableProps>) {
    if (pages.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {hasFilters(query)
                    ? 'No pages match these filters.'
                    : 'No pages yet. Write a page gives Citequill a topic and a kind, and a draft lands here in a few minutes.'}
            </p>
        );
    }

    function sortHead(sort: Sort, label: string, className?: string) {
        const isActive = query.sort === sort;
        const dir = isActive && query.dir === 'desc' ? 'asc' : 'desc';

        const Icon = isActive ? sortIcons[query.dir] : ChevronsUpDownIcon;

        return (
            <TableHead className={className}>
                <Link
                    href={pageListHref(projectId, {
                        ...query,
                        sort,
                        dir,
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
                    {sortHead('title', 'Title')}
                    {sortHead('locale', 'Language')}
                    {sortHead('status', 'State')}
                    {sortHead('published_at', 'Published')}
                    {sortHead('updated_at', 'Updated', 'text-right')}
                </TableRow>
            </TableHeader>
            <TableBody>
                {pages.map((page) => (
                    <TableRow key={page.id}>
                        <TableCell className="font-medium">
                            <Link
                                href={pageHref(projectId, page.id)}
                                className="hover:underline"
                            >
                                {page.title}
                            </Link>
                        </TableCell>
                        <TableCell>{page.locale}</TableCell>
                        <TableCell>
                            <Badge variant={stateVariant(page)}>
                                {stateLabel(page)}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                            {page.published_at
                                ? formatDate(page.published_at)
                                : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                            {formatDate(page.updated_at)}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

type Sort = (typeof pageSorts)[number];

const sortIcons = { asc: ArrowUpIcon, desc: ArrowDownIcon };

function stateLabel(page: PageListItem) {
    if (page.status === 'draft') {
        return page.check_note ? 'Draft, check failed' : 'Draft';
    }

    return page.status === 'published' ? 'Published' : 'Unpublished';
}

function stateVariant(page: PageListItem) {
    if (page.status === 'draft') {
        return page.check_note ? 'destructive' : 'secondary';
    }

    return page.status === 'published' ? 'default' : 'outline';
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

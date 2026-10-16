import Link from 'next/link';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { PageListItem } from '@/features/pages/queries';
import { pageHref } from '@/lib/sections';

interface PageTableProps {
    projectId: string;
    pages: PageListItem[];
}

export default function PageTable({
    projectId,
    pages,
}: Readonly<PageTableProps>) {
    if (pages.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No pages yet. Write a page gives Citequill a topic and a kind,
                and a draft lands here in a few minutes.
            </p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
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
                        <TableCell>{page.page_kinds?.name ?? '—'}</TableCell>
                        <TableCell>{page.locale}</TableCell>
                        <TableCell>{stateLabel(page)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                            {new Date(page.updated_at).toLocaleDateString(
                                'en-GB',
                                { day: 'numeric', month: 'short' },
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function stateLabel(page: PageListItem) {
    if (page.status === 'draft') {
        return page.check_note ? 'Draft, check failed' : 'Draft';
    }

    return page.status === 'published' ? 'Published' : 'Unpublished';
}

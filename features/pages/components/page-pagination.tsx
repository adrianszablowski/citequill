import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
} from '@/components/ui/pagination';
import PageSizeSelect from '@/features/pages/components/page-size-select';
import { pageNumbers } from '@/features/pages/list-query';
import { type PageSize, pageSizes } from '@/features/pages/schema';

interface PagePaginationProps<T extends string> {
    query: { page: number; size: PageSize };
    total: number;
    hrefOf: (change: { page: number; size?: PageSize }) => Route<T>;
}

export default function PagePagination<T extends string>({
    query,
    total,
    hrefOf,
}: Readonly<PagePaginationProps<T>>) {
    if (total === 0) {
        return null;
    }

    const last = Math.ceil(total / query.size);
    const first = (query.page - 1) * query.size + 1;

    function href(page: number) {
        return hrefOf({ page });
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
                {first} to {Math.min(total, first + query.size - 1)} of {total}
            </p>
            <Pagination className="mx-0 w-auto">
                <PaginationContent>
                    <PaginationItem>
                        {query.page > 1 ? (
                            <Button
                                variant="ghost"
                                nativeButton={false}
                                render={<Link href={href(query.page - 1)} />}
                            >
                                <ChevronLeftIcon />
                                Previous
                            </Button>
                        ) : (
                            <Button variant="ghost" disabled>
                                <ChevronLeftIcon />
                                Previous
                            </Button>
                        )}
                    </PaginationItem>
                    {pageNumbers(query.page, last).map((item, index) => (
                        <PaginationItem
                            key={item === 'gap' ? `gap-${index}` : item}
                        >
                            {item === 'gap' ? (
                                <PaginationEllipsis />
                            ) : (
                                <Button
                                    variant={
                                        item === query.page
                                            ? 'outline'
                                            : 'ghost'
                                    }
                                    size="icon"
                                    nativeButton={false}
                                    render={
                                        <Link
                                            href={href(item)}
                                            aria-current={
                                                item === query.page
                                                    ? 'page'
                                                    : undefined
                                            }
                                        />
                                    }
                                >
                                    {item}
                                </Button>
                            )}
                        </PaginationItem>
                    ))}
                    <PaginationItem>
                        {query.page < last ? (
                            <Button
                                variant="ghost"
                                nativeButton={false}
                                render={<Link href={href(query.page + 1)} />}
                            >
                                Next
                                <ChevronRightIcon />
                            </Button>
                        ) : (
                            <Button variant="ghost" disabled>
                                Next
                                <ChevronRightIcon />
                            </Button>
                        )}
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
            <PageSizeSelect
                size={query.size}
                hrefs={pageSizes.map((size) => hrefOf({ page: 1, size }))}
            />
        </div>
    );
}

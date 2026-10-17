'use client';

import { useRouter } from 'next/navigation';

import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { pageListHref } from '@/features/pages/list-query';
import { type PageListQuery, pageSizes } from '@/features/pages/schema';

interface PageSizeSelectProps {
    projectId: string;
    query: PageListQuery;
}

export default function PageSizeSelect({
    projectId,
    query,
}: Readonly<PageSizeSelectProps>) {
    const router = useRouter();

    return (
        <div className="flex items-center gap-2">
            <Label htmlFor="pages-size" className="text-muted-foreground">
                Rows
            </Label>
            <Select
                value={query.size}
                onValueChange={(size) => {
                    if (size) {
                        router.push(
                            pageListHref(projectId, {
                                ...query,
                                size,
                                page: 1,
                            }),
                        );
                    }
                }}
            >
                <SelectTrigger id="pages-size" size="sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {pageSizes.map((size) => (
                        <SelectItem key={size} value={size}>
                            {size}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

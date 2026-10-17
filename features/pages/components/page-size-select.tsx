'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';

import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { type PageSize, pageSizes } from '@/features/pages/schema';

interface PageSizeSelectProps<T extends string> {
    size: PageSize;
    hrefs: Route<T>[];
}

export default function PageSizeSelect<T extends string>({
    size: current,
    hrefs,
}: Readonly<PageSizeSelectProps<T>>) {
    const router = useRouter();

    return (
        <div className="flex items-center gap-2">
            <Label htmlFor="list-size" className="text-muted-foreground">
                Rows
            </Label>
            <Select
                value={current}
                onValueChange={(size) => {
                    if (size) {
                        router.push(hrefs[pageSizes.indexOf(size)]);
                    }
                }}
            >
                <SelectTrigger id="list-size" size="sm">
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

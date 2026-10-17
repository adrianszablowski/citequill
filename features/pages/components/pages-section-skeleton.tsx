import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export default function PagesSectionSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-8 w-32" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-20" />
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        {columns.map((width, column) => (
                            <TableHead key={column}>
                                <Skeleton className={`h-4 ${width}`} />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row}>
                            {columns.map((width, column) => (
                                <TableCell key={column}>
                                    <Skeleton className={`h-4 ${width}`} />
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-7 w-24" />
            </div>
        </div>
    );
}

const columns = ['w-48', 'w-10', 'w-16', 'w-20', 'w-20'];

const rows = [1, 2, 3, 4, 5];

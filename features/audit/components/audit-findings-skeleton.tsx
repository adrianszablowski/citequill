import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuditFindingsSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-20" />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-8 w-36" />
                    <Skeleton className="h-8 w-20" />
                </div>
                <div className="flex flex-col gap-3">
                    {rows.map((row) => (
                        <Skeleton key={row} className="h-8 w-full" />
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-7 w-24" />
                </div>
            </CardContent>
        </Card>
    );
}

const rows = [1, 2, 3, 4, 5];

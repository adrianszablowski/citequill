import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuditSectionSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <Skeleton className="h-10 w-32" />
                        <Skeleton className="h-5 w-48" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        {facts.map((fact) => (
                            <div key={fact} className="flex flex-col gap-1">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-6 w-12" />
                            </div>
                        ))}
                    </div>
                    <Skeleton className="h-8 w-full sm:w-40" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {rows.map((row) => (
                        <Skeleton key={row} className="h-8 w-full" />
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

const facts = [1, 2, 3];

const rows = [1, 2, 3];

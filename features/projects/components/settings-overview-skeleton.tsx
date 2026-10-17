import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsOverviewSkeleton() {
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {cards.map((rows) => (
                <Card key={rows}>
                    <CardHeader>
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {Array.from({ length: rows }, (_, row) => (
                            <Skeleton key={row} className="h-8 w-full" />
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

const cards = [3, 4, 2, 1];

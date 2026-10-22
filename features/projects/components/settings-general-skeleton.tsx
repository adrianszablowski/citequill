import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsGeneralSkeleton() {
    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {cards.map(({ rows, hasButton }, card) => (
                <Card key={card}>
                    <CardHeader>
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {Array.from({ length: rows }, (_, row) => (
                            <Skeleton key={row} className="h-8 w-full" />
                        ))}
                        {hasButton && <Skeleton className="h-8 w-32" />}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

const cards = [
    { rows: 3, hasButton: false },
    { rows: 5, hasButton: true },
    { rows: 3, hasButton: true },
    { rows: 7, hasButton: true },
    { rows: 0, hasButton: true },
];

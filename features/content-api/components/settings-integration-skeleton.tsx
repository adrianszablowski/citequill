import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { examples } from '@/features/content-api/examples';

export default function SettingsIntegrationSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            {cards.map(({ rows, hasButton }, card) => (
                <Card key={card}>
                    <CardHeader>
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {Array.from({ length: rows }, (_, row) => (
                            <Skeleton key={row} className="h-8 w-full" />
                        ))}
                        {hasButton && <Skeleton className="h-8 w-28" />}
                    </CardContent>
                </Card>
            ))}
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {examples('').map(({ id, code }) => (
                        <div key={id} className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-8 w-20" />
                            </div>
                            <Skeleton
                                className="w-full"
                                style={{ height: codeHeight(code) }}
                            />
                        </div>
                    ))}
                    <Skeleton className="h-5 w-40" />
                </CardContent>
            </Card>
        </div>
    );
}

function codeHeight(code: string) {
    return `${code.split('\n').length + 1.5}rem`;
}

const cards = [
    { rows: 3, hasButton: true },
    { rows: 2, hasButton: false },
];

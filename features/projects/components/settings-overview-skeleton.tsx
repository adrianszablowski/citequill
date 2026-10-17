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
            <Card className="lg:col-span-2">
                <CardHeader>
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-3/4" />
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full sm:w-48" />
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                        {firewalls.map((firewall) => (
                            <div key={firewall} className="flex flex-col gap-2">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ))}
                    </div>
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

const cards = [3, 4, 2, 1];

const firewalls = ['cloudflare', 'vercel'];

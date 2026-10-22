import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function PageEditorSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-32" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <CardAction>
                        <Skeleton className="h-8 w-20" />
                    </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                </CardContent>
                <CardContent className="mx-auto flex w-full max-w-prose flex-col gap-4">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-9 w-3/4" />
                    {paragraphs.map((paragraph) => (
                        <div key={paragraph} className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

const paragraphs = [1, 2, 3, 4];

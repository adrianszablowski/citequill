import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SkillEditorSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-32" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    {fields.map((field) => (
                        <div key={field} className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ))}
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="min-h-96 w-full" />
                    </div>
                    <Skeleton className="h-8 w-20 self-start" />
                </CardContent>
            </Card>
        </div>
    );
}

const fields = ['name', 'description'];

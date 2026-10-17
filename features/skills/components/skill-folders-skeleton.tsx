import { Card, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { skillFolders } from '@/features/skills/folders';

export default function SkillFoldersSkeleton() {
    return (
        <div className="flex flex-col gap-10">
            {skillFolders.map((folder, index) => (
                <section key={folder.folder} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    {tilesPerFolder[index] > 0 && (
                        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {Array.from(
                                { length: tilesPerFolder[index] },
                                (_, tile) => (
                                    <li key={tile}>
                                        <Card size="sm" className="h-full">
                                            <CardHeader>
                                                <Skeleton className="h-4 w-1/2" />
                                                <Skeleton className="h-4 w-5/6" />
                                            </CardHeader>
                                        </Card>
                                    </li>
                                ),
                            )}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}

const tilesPerFolder = [6, 3, 0];

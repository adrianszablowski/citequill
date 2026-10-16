import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import SkillFolders from '@/features/skills/components/skill-folders';

export default function SkillsTab({
    params,
}: PageProps<'/projects/[id]/skills'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                What Citequill knows about this site. Open a skill to read or
                edit it.
            </p>
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <SkillFolders params={params} />
            </Suspense>
        </section>
    );
}

import { Suspense } from 'react';

import SkillFolders from '@/features/skills/components/skill-folders';
import SkillFoldersSkeleton from '@/features/skills/components/skill-folders-skeleton';

export default function SkillsTab({
    params,
}: PageProps<'/projects/[id]/skills'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                What Citequill knows about this site. Open a skill to read or
                edit it.
            </p>
            <Suspense fallback={<SkillFoldersSkeleton />}>
                <SkillFolders params={params} />
            </Suspense>
        </section>
    );
}

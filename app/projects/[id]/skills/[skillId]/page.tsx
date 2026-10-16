import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import SkillEditorSection from '@/features/skills/components/skill-editor-section';

export default function SkillPage({
    params,
}: PageProps<'/projects/[id]/skills/[skillId]'>) {
    return (
        <section className="flex flex-col gap-6">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <SkillEditorSection params={params} />
            </Suspense>
        </section>
    );
}

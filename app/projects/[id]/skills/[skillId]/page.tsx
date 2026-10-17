import { Suspense } from 'react';

import SkillEditorSection from '@/features/skills/components/skill-editor-section';
import SkillEditorSkeleton from '@/features/skills/components/skill-editor-skeleton';

export default function SkillPage({
    params,
}: PageProps<'/projects/[id]/skills/[skillId]'>) {
    return (
        <section className="flex flex-col gap-6">
            <Suspense fallback={<SkillEditorSkeleton />}>
                <SkillEditorSection params={params} />
            </Suspense>
        </section>
    );
}

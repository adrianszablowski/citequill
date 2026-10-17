import { notFound } from 'next/navigation';

import BackLink from '@/components/back-link';
import { getCurrentUser } from '@/features/auth/queries';
import SkillEditor from '@/features/skills/components/skill-editor';
import { getSkill } from '@/features/skills/queries';
import { sectionHref } from '@/lib/sections';

interface SkillEditorSectionProps {
    params: Promise<{ id: string; skillId: string }>;
}

export default async function SkillEditorSection({
    params,
}: Readonly<SkillEditorSectionProps>) {
    const { id, skillId } = await params;

    await getCurrentUser();

    const skill = await getSkill(id, skillId);

    if (!skill) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-4">
            <BackLink href={sectionHref(id, 'skills')}>Back to Skills</BackLink>
            <SkillEditor skill={skill} />
        </div>
    );
}

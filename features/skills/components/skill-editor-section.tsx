import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
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
            <Button
                nativeButton={false}
                render={<Link href={sectionHref(id, 'skills')} />}
                variant="ghost"
                className="self-start"
            >
                Back to Skills
            </Button>
            <SkillEditor skill={skill} />
        </div>
    );
}

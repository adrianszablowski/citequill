import Link from 'next/link';

import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { SkillListItem } from '@/features/skills/queries';
import { skillHref } from '@/lib/sections';

interface SkillTileProps {
    projectId: string;
    skill: SkillListItem;
}

export default function SkillTile({
    projectId,
    skill,
}: Readonly<SkillTileProps>) {
    return (
        <Link
            href={skillHref(projectId, skill.id)}
            className="block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <Card
                size="sm"
                className="h-full transition-colors hover:bg-muted/50"
            >
                <CardHeader>
                    <CardTitle>{skill.name}</CardTitle>
                    {skill.description && (
                        <CardDescription>{skill.description}</CardDescription>
                    )}
                </CardHeader>
            </Card>
        </Link>
    );
}

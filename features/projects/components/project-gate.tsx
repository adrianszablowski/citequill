import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/queries';
import { hasProductSkill } from '@/features/skills/queries';

interface ProjectGateProps {
    params: Promise<{ id: string }>;
}

export default async function ProjectGate({
    params,
}: Readonly<ProjectGateProps>): Promise<null> {
    const { id } = await params;

    await getCurrentUser();

    if (!(await hasProductSkill(id))) {
        redirect(`/connect/${id}`);
    }

    return null;
}

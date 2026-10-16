import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/queries';
import ProjectSwitcher from '@/features/projects/components/project-switcher';
import { getProjectList } from '@/features/projects/queries';

interface SidebarProjectsProps {
    params: Promise<{ id: string }>;
}

export default async function SidebarProjects({
    params,
}: Readonly<SidebarProjectsProps>) {
    const { id } = await params;

    await getCurrentUser();

    const projects = await getProjectList();

    if (!projects.some((project) => project.id === id)) {
        notFound();
    }

    return <ProjectSwitcher projects={projects} currentId={id} />;
}

import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/queries';
import { getProjectList } from '@/features/projects/queries';
import { sectionHref } from '@/lib/sections';

export default async function HomeRedirect(): Promise<null> {
    await getCurrentUser();

    const [project] = await getProjectList();

    redirect(project ? sectionHref(project.id, 'pages') : '/connect');
}

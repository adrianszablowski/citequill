import SectionNav from '@/components/section-nav';
import { getCurrentUser } from '@/features/auth/queries';
import { getPageKinds } from '@/features/projects/queries';

interface SidebarSectionsProps {
    params: Promise<{ id: string }>;
}

export default async function SidebarSections({
    params,
}: Readonly<SidebarSectionsProps>) {
    const { id } = await params;

    await getCurrentUser();

    const kinds = await getPageKinds(id);

    return (
        <SectionNav
            projectId={id}
            kinds={kinds.map((kind) => ({ id: kind.id, name: kind.name }))}
        />
    );
}

import { notFound } from 'next/navigation';

import BackLink from '@/components/back-link';
import { getCurrentUser } from '@/features/auth/queries';
import PageEditor from '@/features/pages/components/page-editor';
import { getPage } from '@/features/pages/queries';
import { sectionHref } from '@/lib/sections';

interface PageEditorSectionProps {
    params: Promise<{ id: string; pageId: string }>;
}

export default async function PageEditorSection({
    params,
}: Readonly<PageEditorSectionProps>) {
    const { id, pageId } = await params;

    await getCurrentUser();

    const page = await getPage(id, pageId);

    if (!page) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-4">
            <BackLink href={sectionHref(id, 'pages')}>Back to Pages</BackLink>
            <PageEditor page={page} />
        </div>
    );
}

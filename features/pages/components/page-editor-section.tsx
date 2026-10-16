import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/features/auth/queries';
import PageEditor from '@/features/pages/components/page-editor';
import PagePreview from '@/features/pages/components/page-preview';
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
            <Button
                nativeButton={false}
                render={<Link href={sectionHref(id, 'pages')} />}
                variant="ghost"
                className="self-start"
            >
                Back to Pages
            </Button>
            <div className="grid gap-6 xl:grid-cols-2">
                <PageEditor page={page} />
                <PagePreview page={page} />
            </div>
        </div>
    );
}

import { Suspense } from 'react';

import PageEditorSection from '@/features/pages/components/page-editor-section';
import PageEditorSkeleton from '@/features/pages/components/page-editor-skeleton';

export default function PageEditorPage({
    params,
}: PageProps<'/projects/[id]/pages/[pageId]'>) {
    return (
        <section className="flex flex-col gap-6">
            <Suspense fallback={<PageEditorSkeleton />}>
                <PageEditorSection params={params} />
            </Suspense>
        </section>
    );
}

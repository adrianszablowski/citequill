import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import PageEditorSection from '@/features/pages/components/page-editor-section';

export default function PageEditorPage({
    params,
}: PageProps<'/projects/[id]/pages/[pageId]'>) {
    return (
        <section className="flex flex-col gap-6">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <PageEditorSection params={params} />
            </Suspense>
        </section>
    );
}

import { Suspense } from 'react';

import PagesSection from '@/features/pages/components/pages-section';
import PagesSectionSkeleton from '@/features/pages/components/pages-section-skeleton';

export default function PagesTab({
    params,
    searchParams,
}: PageProps<'/projects/[id]/pages'>) {
    return (
        <section className="flex flex-col gap-6">
            <Suspense fallback={<PagesSectionSkeleton />}>
                <PagesSection params={params} searchParams={searchParams} />
            </Suspense>
        </section>
    );
}

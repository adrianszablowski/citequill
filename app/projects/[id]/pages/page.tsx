import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import PagesSection from '@/features/pages/components/pages-section';

export default function PagesTab({
    params,
}: PageProps<'/projects/[id]/pages'>) {
    return (
        <section className="flex flex-col gap-6">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                <PagesSection params={params} />
            </Suspense>
        </section>
    );
}

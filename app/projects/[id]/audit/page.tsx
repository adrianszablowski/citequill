import { Suspense } from 'react';

import AuditSection from '@/features/audit/components/audit-section';
import AuditSectionSkeleton from '@/features/audit/components/audit-section-skeleton';

export default function AuditTab({
    params,
    searchParams,
}: PageProps<'/projects/[id]/audit'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                Citequill reads the pages of the site, checks them against what
                Google documents and scores the site from 0 to 100.
            </p>
            <Suspense fallback={<AuditSectionSkeleton />}>
                <AuditSection params={params} searchParams={searchParams} />
            </Suspense>
        </section>
    );
}

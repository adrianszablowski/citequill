import { Suspense } from 'react';

import AuditSection from '@/features/audit/components/audit-section';
import AuditSectionSkeleton from '@/features/audit/components/audit-section-skeleton';

export default function AuditTab({
    params,
}: PageProps<'/projects/[id]/audit'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                Citequill reads the pages of the site and counts the ones Google
                can index.
            </p>
            <Suspense fallback={<AuditSectionSkeleton />}>
                <AuditSection params={params} />
            </Suspense>
        </section>
    );
}

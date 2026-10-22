import { Suspense } from 'react';

import SettingsGeneral from '@/features/projects/components/settings-general';
import SettingsGeneralSkeleton from '@/features/projects/components/settings-general-skeleton';

export default function SettingsTab({
    params,
}: PageProps<'/projects/[id]/settings'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                The crawl fills in the locales, the page kinds, the first author
                and the organization. What it could not find is not set yet.
            </p>
            <Suspense fallback={<SettingsGeneralSkeleton />}>
                <SettingsGeneral params={params} />
            </Suspense>
        </section>
    );
}

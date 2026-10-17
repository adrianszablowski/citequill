import { Suspense } from 'react';

import SettingsOverview from '@/features/projects/components/settings-overview';
import SettingsOverviewSkeleton from '@/features/projects/components/settings-overview-skeleton';

export default function SettingsTab({
    params,
}: PageProps<'/projects/[id]/settings'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                What the crawl found: locales, page kinds and authors. The mode
                of the project and its keys come with the steps that need them.
            </p>
            <Suspense fallback={<SettingsOverviewSkeleton />}>
                <SettingsOverview params={params} />
            </Suspense>
        </section>
    );
}

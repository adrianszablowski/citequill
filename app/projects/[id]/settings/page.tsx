import { Suspense } from 'react';

import SettingsOverview from '@/features/projects/components/settings-overview';
import SettingsOverviewSkeleton from '@/features/projects/components/settings-overview-skeleton';

export default function SettingsTab({
    params,
}: PageProps<'/projects/[id]/settings'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                The crawl fills in the locales, page kinds and authors. The bot
                secret lets the audit through your firewall.
            </p>
            <Suspense fallback={<SettingsOverviewSkeleton />}>
                <SettingsOverview params={params} />
            </Suspense>
        </section>
    );
}

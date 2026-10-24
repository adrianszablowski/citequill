import { Suspense } from 'react';

import SettingsIntegration from '@/features/content-api/components/settings-integration';
import SettingsIntegrationSkeleton from '@/features/content-api/components/settings-integration-skeleton';

export default function SettingsIntegrationTab({
    params,
}: PageProps<'/projects/[id]/settings/integration'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                Your site reads its live pages from the Content API.
            </p>
            <Suspense fallback={<SettingsIntegrationSkeleton />}>
                <SettingsIntegration params={params} />
            </Suspense>
        </section>
    );
}

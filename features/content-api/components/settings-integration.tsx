import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/queries';
import ApiExamples from '@/features/content-api/components/api-examples';
import SiteKeys from '@/features/content-api/components/site-keys';
import SitemapLines from '@/features/content-api/components/sitemap-lines';
import { getIntegration } from '@/features/content-api/queries';
import { hostOf } from '@/features/content-api/urls';

interface SettingsIntegrationProps {
    params: Promise<{ id: string }>;
}

export default async function SettingsIntegration({
    params,
}: Readonly<SettingsIntegrationProps>) {
    const { id } = await params;

    await getCurrentUser();

    const integration = await getIntegration(id);

    if (integration === null) {
        notFound();
    }

    const { siteId, keys, locales } = integration;

    return (
        <div className="flex flex-col gap-6">
            <SiteKeys projectId={id} siteId={siteId} keys={keys} />
            <SitemapLines
                siteId={siteId}
                hosts={[
                    ...new Set(locales.map(({ base_url }) => hostOf(base_url))),
                ]}
            />
            <ApiExamples siteId={siteId} locale={locales[0]?.locale} />
        </div>
    );
}

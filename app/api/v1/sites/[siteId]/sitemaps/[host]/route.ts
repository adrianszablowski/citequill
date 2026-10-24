import type { NextRequest } from 'next/server';

import { getHostSitemap } from '@/features/content-api/endpoints';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/v1/sites/[siteId]/sitemaps/[host]'>,
) {
    const { siteId, host } = await params;

    return getHostSitemap(request, siteId, host);
}

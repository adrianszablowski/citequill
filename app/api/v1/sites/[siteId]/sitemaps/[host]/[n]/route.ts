import type { NextRequest } from 'next/server';

import { getSitemapFile } from '@/features/content-api/endpoints';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/v1/sites/[siteId]/sitemaps/[host]/[n]'>,
) {
    const { siteId, host, n } = await params;

    return getSitemapFile(request, siteId, host, n);
}

import type { NextRequest } from 'next/server';

import { getSitemap } from '@/features/content-api/endpoints';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/v1/sites/[siteId]/sitemap'>,
) {
    const { siteId } = await params;

    return getSitemap(request, siteId);
}

import type { NextRequest } from 'next/server';

import { getRedirects } from '@/features/content-api/endpoints';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/v1/sites/[siteId]/redirects'>,
) {
    const { siteId } = await params;

    return getRedirects(request, siteId);
}

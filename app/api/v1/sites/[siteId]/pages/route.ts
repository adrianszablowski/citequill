import type { NextRequest } from 'next/server';

import { getPages } from '@/features/content-api/endpoints';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/v1/sites/[siteId]/pages'>,
) {
    const { siteId } = await params;

    return getPages(request, siteId);
}

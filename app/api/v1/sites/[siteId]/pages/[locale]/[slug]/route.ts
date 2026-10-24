import type { NextRequest } from 'next/server';

import { getPage } from '@/features/content-api/endpoints';

export async function GET(
    request: NextRequest,
    { params }: RouteContext<'/api/v1/sites/[siteId]/pages/[locale]/[slug]'>,
) {
    const { siteId, locale, slug } = await params;

    return getPage(request, siteId, locale, slug);
}

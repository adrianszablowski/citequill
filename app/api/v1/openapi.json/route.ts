import { openApi } from '@/features/content-api/openapi';

export function GET() {
    return Response.json(openApi());
}

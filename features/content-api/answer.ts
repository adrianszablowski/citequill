import { createHash } from 'node:crypto';

import { unstable_rethrow } from 'next/navigation';

import { syncTokenDays } from '@/features/content-api/paging';
import { docsUrl } from '@/features/content-api/urls';

export type ProblemCode = keyof typeof problems;

export function jsonAnswer(
    request: Request,
    data: unknown,
    headers: Record<string, string> = {},
) {
    return answer(request, JSON.stringify(data), {
        'Content-Type': 'application/json',
        ...headers,
    });
}

export function xmlAnswer(request: Request, xml: string) {
    return answer(request, xml, {
        'Content-Type': 'application/xml; charset=utf-8',
    });
}

export function problem(
    code: ProblemCode,
    detail?: string,
    extension: Record<string, unknown> = {},
) {
    const { status, title, detail: fallback } = problems[code];

    const body = JSON.stringify({
        type: docsUrl(`#${code}`),
        title,
        status,
        detail: detail ?? fallback,
        code,
        ...extension,
    });

    return answer(
        null,
        body,
        {
            'Content-Type': 'application/problem+json',
            ...(status === 401 && {
                'WWW-Authenticate':
                    code === 'invalid_key'
                        ? invalidKeyChallenge
                        : bearerChallenge,
            }),
        },
        status,
    );
}

export function answered<Args extends unknown[]>(
    handler: (...args: Args) => Promise<Response>,
) {
    return async (...args: Args) => {
        try {
            return await handler(...args);
        } catch (cause) {
            unstable_rethrow(cause);
            console.error('The Content API did not answer.', cause);

            return problem('server_error');
        }
    };
}

export function nextLink(request: Request, cursor: string) {
    const url = new URL(request.url);

    url.searchParams.set('cursor', cursor);

    return { Link: `<${url}>; rel="next"` };
}

function answer(
    request: Request | null,
    body: string,
    headers: Record<string, string>,
    status = 200,
) {
    const etag = `W/"${createHash('sha256').update(body).digest('base64url')}"`;
    const cache = { 'Cache-Control': cacheControl, ETag: etag };

    if (status === 200 && request && isFresh(request, etag)) {
        return new Response(null, { status: 304, headers: cache });
    }

    return new Response(body, { status, headers: { ...headers, ...cache } });
}

function isFresh(request: Request, etag: string) {
    const header = request.headers.get('If-None-Match');

    if (!header) {
        return false;
    }

    const opaque = (tag: string) => tag.trim().replace(/^W\//, '');

    return (
        header.trim() === '*' ||
        header.split(',').some((tag) => opaque(tag) === opaque(etag))
    );
}

export const cacheControl = 'private, no-cache';

export const bearerChallenge = 'Bearer realm="citequill"';

export const invalidKeyChallenge = `${bearerChallenge}, error="invalid_token"`;

export const problems = {
    missing_key: {
        status: 401,
        title: 'No key',
        detail: 'The request has no Authorization header with Bearer and a key. Send a Content API key in it.',
    },
    invalid_key: {
        status: 401,
        title: 'Unknown key',
        detail: 'Citequill has no such key. It was deleted, or a character of it changed. Copy the key again, or make a new one in Settings, Integration.',
    },
    wrong_site: {
        status: 403,
        title: 'Key of another project',
        detail: 'The key belongs to another project. Use a key made in the Settings of the project whose site id is in the path.',
    },
    invalid_parameter: {
        status: 400,
        title: 'Parameter not accepted',
        detail: 'A parameter of the request is unknown or malformed.',
    },
    invalid_cursor: {
        status: 400,
        title: 'Cursor does not fit',
        detail: 'The cursor does not fit this request. Send it back as the previous answer gave it, with the same filters.',
    },
    page_not_found: {
        status: 404,
        title: 'Page not found',
        detail: 'No page with this locale and slug was ever published.',
    },
    site_not_found: {
        status: 404,
        title: 'Site not found',
        detail: 'No project has this site id.',
    },
    host_not_found: {
        status: 404,
        title: 'Host not found',
        detail: "The host is not among the base URLs of the project's locales.",
    },
    sitemap_not_found: {
        status: 404,
        title: 'Sitemap file not found',
        detail: "The host's sitemap has fewer files. Start from the host's sitemap.",
    },
    page_unpublished: {
        status: 410,
        title: 'Page unpublished',
        detail: 'The page was unpublished. Answer with a 301 to redirect.to, or with 410 when redirect is null.',
    },
    sync_token_invalid: {
        status: 410,
        title: 'Sync token not accepted',
        detail: `The sync token is older than ${syncTokenDays} days, or it is not a token. Sync again from sync=start.`,
    },
    server_error: {
        status: 500,
        title: 'Server error',
        detail: 'Citequill could not answer the request. Send it again in a few minutes.',
    },
} as const;

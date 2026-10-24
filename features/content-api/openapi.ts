import {
    bearerChallenge,
    cacheControl,
    invalidKeyChallenge,
    type ProblemCode,
    problems,
} from '@/features/content-api/answer';
import { keyPrefix, secretCharacters } from '@/features/content-api/key';
import {
    longLimits,
    pageLimits,
    syncTokenDays,
} from '@/features/content-api/paging';
import { sitemapLimits } from '@/features/content-api/sitemap-xml';
import { apiUrl, docsUrl } from '@/features/content-api/urls';
import { formatCount } from '@/lib/utils';

export function openApi() {
    return {
        openapi: '3.1.0',
        info: {
            title: 'Citequill Content API',
            version: '1',
            description: `The live pages of a project, read by the site's server or build with a Content API key. The guide is at ${docsUrl()}.`,
        },
        servers: [{ url: apiUrl() }],
        security: [{ key: [] }],
        paths: {
            '/sites/{siteId}/pages': {
                get: {
                    operationId: 'listPages',
                    summary: 'List the live pages, or sync the changes',
                    description:
                        'Without sync or updatedSince, the live pages, newest first publication first, filtered by locale and kind. With sync=start, sync=<token> or updatedSince=<date>, every page that changed since, once, oldest change first. A live page comes as a page object and an unpublished one as a removal record. The last page of a sync carries nextSyncToken. A sync takes no locale or kind.',
                    parameters: [
                        siteId,
                        {
                            name: 'locale',
                            in: 'query',
                            description:
                                'A language, or a language and a two-letter country, such as pl or en-US, in any case.',
                            schema: { type: 'string' },
                        },
                        {
                            name: 'kind',
                            in: 'query',
                            description: 'The name of a page kind.',
                            schema: { type: 'string' },
                        },
                        {
                            name: 'sync',
                            in: 'query',
                            description: `start for the first sync, or the nextSyncToken of the last one. A token lasts ${syncTokenDays} days.`,
                            schema: { type: 'string' },
                        },
                        {
                            name: 'updatedSince',
                            in: 'query',
                            description:
                                'Starts a sync from a date in RFC 3339 with any offset. A + in it is sent as %2B.',
                            schema: { type: 'string', format: 'date-time' },
                        },
                        limit(pageLimits),
                        cursor,
                    ],
                    responses: {
                        '200': json(
                            'The live pages, or the changes of a sync',
                            ref('PageList'),
                            { Link: linkHeader },
                        ),
                        '304': notModified,
                        ...errors([
                            'invalid_parameter',
                            'invalid_cursor',
                            'missing_key',
                            'invalid_key',
                            'wrong_site',
                            'sync_token_invalid',
                            'server_error',
                        ]),
                    },
                },
            },
            '/sites/{siteId}/pages/{locale}/{slug}': {
                get: {
                    operationId: 'getPage',
                    summary: 'Get one live page',
                    parameters: [
                        siteId,
                        {
                            name: 'locale',
                            in: 'path',
                            required: true,
                            description: 'The locale of the page, in any case.',
                            schema: { type: 'string' },
                        },
                        {
                            name: 'slug',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    responses: {
                        '200': json('The page', ref('PageObject'), {
                            'Last-Modified': {
                                description:
                                    'When the published version last changed: a publication, a change of its alternates, or an edit in Settings or a crawl that changes what it shows.',
                                schema: { type: 'string' },
                            },
                        }),
                        '304': notModified,
                        ...errors([
                            'invalid_parameter',
                            'missing_key',
                            'invalid_key',
                            'wrong_site',
                            'page_not_found',
                            'server_error',
                        ]),
                        '410': {
                            headers: cacheHeaders,
                            description:
                                'The page is unpublished. redirect says what to answer: a 301 to redirect.to, or 410 when it is null.',
                            content: {
                                'application/problem+json': {
                                    schema: {
                                        allOf: [
                                            ref('Problem'),
                                            {
                                                type: 'object',
                                                required: ['redirect'],
                                                properties: {
                                                    redirect: ref('Redirect'),
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/sites/{siteId}/redirects': {
                get: {
                    operationId: 'listRedirects',
                    summary: 'List the unpublished pages',
                    description:
                        'A removal record for every unpublished page, newest unpublishedAt first.',
                    parameters: [siteId, limit(longLimits), cursor],
                    responses: {
                        '200': json(
                            'The removal records',
                            list('redirects', ref('RemovalRecord')),
                            { Link: linkHeader },
                        ),
                        '304': notModified,
                        ...errors([
                            'invalid_parameter',
                            'invalid_cursor',
                            'missing_key',
                            'invalid_key',
                            'wrong_site',
                            'server_error',
                        ]),
                    },
                },
            },
            '/sites/{siteId}/sitemap': {
                get: {
                    operationId: 'listSitemap',
                    summary: 'List the URLs of the live pages',
                    description:
                        'For a site that merges the pages into a sitemap of its own, newest first publication first.',
                    parameters: [siteId, limit(longLimits), cursor],
                    responses: {
                        '200': json(
                            'The URLs',
                            list('urls', ref('SitemapUrl')),
                            { Link: linkHeader },
                        ),
                        '304': notModified,
                        ...errors([
                            'invalid_parameter',
                            'invalid_cursor',
                            'missing_key',
                            'invalid_key',
                            'wrong_site',
                            'server_error',
                        ]),
                    },
                },
            },
            '/sites/{siteId}/sitemaps/{host}.xml': {
                get: {
                    operationId: 'getHostSitemap',
                    summary: 'Get the XML sitemap of one host',
                    description:
                        "The urlset of the host's live pages when one file holds them, else a sitemap index of its files. It takes no key; name it in the host's robots.txt.",
                    security: [],
                    parameters: [siteId, host],
                    responses: {
                        '200': xml('The urlset or the sitemap index'),
                        '304': notModified,
                        ...errors([
                            'invalid_parameter',
                            'site_not_found',
                            'host_not_found',
                            'server_error',
                        ]),
                    },
                },
            },
            '/sites/{siteId}/sitemaps/{host}/{n}.xml': {
                get: {
                    operationId: 'getSitemapFile',
                    summary: "Get one file of a host's XML sitemap",
                    description: `Each file holds at most ${formatCount(sitemapLimits.urls)} URLs and ${formatCount(sitemapLimits.bytes)} bytes.`,
                    security: [],
                    parameters: [
                        siteId,
                        host,
                        {
                            name: 'n',
                            in: 'path',
                            required: true,
                            description: 'The number of the file, from 1.',
                            schema: { type: 'integer', minimum: 1 },
                        },
                    ],
                    responses: {
                        '200': xml('The urlset of the file'),
                        '304': notModified,
                        ...errors([
                            'invalid_parameter',
                            'site_not_found',
                            'host_not_found',
                            'sitemap_not_found',
                            'server_error',
                        ]),
                    },
                },
            },
            '/openapi.json': {
                get: {
                    operationId: 'getOpenApi',
                    summary: 'Get this document',
                    security: [],
                    responses: {
                        '200': {
                            description: 'The OpenAPI 3.1 document of v1',
                            content: {
                                'application/json': {
                                    schema: { type: 'object' },
                                },
                            },
                        },
                    },
                },
            },
        },
        components: {
            securitySchemes: {
                key: {
                    type: 'http',
                    scheme: 'bearer',
                    description: `A Content API key, ${keyPrefix} and ${secretCharacters} characters, made in Settings, Integration.`,
                },
            },
            schemas,
        },
    };
}

function ref(name: keyof typeof schemas) {
    return { $ref: `#/components/schemas/${name}` };
}

function json(
    description: string,
    schema: object,
    headers: Record<string, object> = {},
) {
    return {
        description,
        headers: { ...cacheHeaders, ...headers },
        content: { 'application/json': { schema } },
    };
}

function xml(description: string) {
    return {
        description,
        headers: cacheHeaders,
        content: { 'application/xml': { schema: { type: 'string' } } },
    };
}

function list(field: string, item: object) {
    return {
        type: 'object',
        required: [field, 'nextCursor'],
        properties: {
            [field]: { type: 'array', items: item },
            nextCursor: nullable({ type: 'string' }),
        },
    };
}

function errors(codes: ProblemCode[]) {
    const statuses = [...new Set(codes.map((code) => problems[code].status))];

    return Object.fromEntries(
        statuses.map((status) => [
            String(status),
            {
                description: codes
                    .filter((code) => problems[code].status === status)
                    .map((code) => `${code}: ${problems[code].detail}`)
                    .join(' '),
                headers:
                    status === 401
                        ? { ...cacheHeaders, 'WWW-Authenticate': challenge }
                        : cacheHeaders,
                content: {
                    'application/problem+json': { schema: ref('Problem') },
                },
            },
        ]),
    );
}

function limit({ fallback, max }: { fallback: number; max: number }) {
    return {
        name: 'limit',
        in: 'query',
        description: `How many items a page holds. A larger number counts as ${formatCount(max)}.`,
        schema: { type: 'integer', minimum: 1, default: fallback },
    };
}

function nullable(schema: object) {
    return { oneOf: [schema, { type: 'null' }] };
}

const siteId = {
    name: 'siteId',
    in: 'path',
    required: true,
    description: "The project's site id, in Settings, Integration.",
    schema: { type: 'string' },
};

const host = {
    name: 'host',
    in: 'path',
    required: true,
    description: "A host among the base URLs of the project's locales.",
    schema: { type: 'string' },
};

const cursor = {
    name: 'cursor',
    in: 'query',
    description:
        'The nextCursor of the previous answer, sent back as it came, with the same filters.',
    schema: { type: 'string' },
};

const cacheHeaders = {
    ETag: {
        description: 'A weak ETag of the body. Send it back in If-None-Match.',
        schema: { type: 'string' },
    },
    'Cache-Control': {
        description: `Always ${cacheControl}.`,
        schema: { type: 'string' },
    },
};

const challenge = {
    description: `${bearerChallenge}, and ${invalidKeyChallenge} for invalid_key.`,
    schema: { type: 'string' },
};

const linkHeader = {
    description: 'The next page, as <url>; rel="next", when there is one.',
    schema: { type: 'string' },
};

const notModified = {
    description: 'The body matches the ETag sent in If-None-Match.',
    headers: cacheHeaders,
};

const date = {
    type: 'string',
    format: 'date-time',
    description: 'RFC 3339 in UTC with Z and 3 fractional digits.',
};

const nameAndUrl = {
    type: 'object',
    required: ['name', 'url'],
    properties: { name: { type: 'string' }, url: { type: 'string' } },
};

const schemas = {
    Problem: {
        type: 'object',
        description: 'An RFC 9457 problem.',
        required: ['type', 'title', 'status', 'detail', 'code'],
        properties: {
            type: {
                type: 'string',
                description: 'The entry of the problem in the guide.',
            },
            title: { type: 'string' },
            status: { type: 'integer' },
            detail: {
                type: 'string',
                description: 'For people; it may change.',
            },
            code: {
                type: 'string',
                description: 'A stable string a client may branch on.',
                enum: Object.keys(problems),
            },
        },
    },
    Alternate: {
        type: 'object',
        required: ['hreflang', 'url'],
        properties: {
            hreflang: {
                type: 'string',
                description: 'A locale in BCP 47, or x-default.',
            },
            url: { type: 'string' },
        },
    },
    Redirect: nullable({
        type: 'object',
        required: ['status', 'to'],
        properties: {
            status: { type: 'integer', enum: [301] },
            to: { type: 'string', description: 'An absolute URL.' },
        },
    }),
    RemovalRecord: {
        type: 'object',
        required: [
            'id',
            'locale',
            'path',
            'url',
            'status',
            'unpublishedAt',
            'redirect',
        ],
        properties: {
            id: { type: 'string' },
            locale: { type: 'string' },
            path: {
                type: 'string',
                description: 'The path the page was published under.',
            },
            url: {
                type: 'string',
                description: 'The URL the page was published under.',
            },
            status: { type: 'string', enum: ['unpublished'] },
            unpublishedAt: date,
            redirect: {
                $ref: '#/components/schemas/Redirect',
                description: 'A 301 with its target, or null for 410.',
            },
        },
    },
    SitemapUrl: {
        type: 'object',
        required: ['url', 'lastmod', 'alternates'],
        properties: {
            url: { type: 'string' },
            lastmod: { ...date, description: 'The content date, updatedAt.' },
            alternates: {
                type: 'array',
                items: { $ref: '#/components/schemas/Alternate' },
            },
        },
    },
    PageObject: {
        type: 'object',
        required: [
            'id',
            'status',
            'kind',
            'locale',
            'hreflang',
            'ogLocale',
            'slug',
            'path',
            'url',
            'canonical',
            'alternates',
            'title',
            'metaTitle',
            'metaDescription',
            'excerpt',
            'body',
            'toc',
            'faq',
            'sources',
            'tags',
            'primaryTag',
            'author',
            'publisher',
            'breadcrumbs',
            'publishedAt',
            'updatedAt',
            'readingMinutes',
            'wordCount',
            'openGraph',
            'jsonLd',
        ],
        properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: ['published'] },
            kind: nullable({
                type: 'string',
                description: 'The name of the page kind.',
            }),
            locale: { type: 'string', description: 'BCP 47, such as en-US.' },
            hreflang: { type: 'string' },
            ogLocale: { type: 'string', description: 'Such as en_US.' },
            slug: { type: 'string' },
            path: {
                type: 'string',
                description:
                    'The path on the site, as it was when the page was first published.',
            },
            url: { type: 'string' },
            canonical: { type: 'string' },
            alternates: {
                type: 'array',
                description:
                    'Every live language version, the page itself included, and x-default for the main locale when it is live.',
                items: { $ref: '#/components/schemas/Alternate' },
            },
            title: { type: 'string', description: 'The H1.' },
            metaTitle: { type: 'string', description: 'The <title>.' },
            metaDescription: { type: 'string' },
            excerpt: {
                type: 'string',
                description: 'One paragraph for lists and Open Graph.',
            },
            body: {
                type: 'object',
                required: ['markdown', 'html'],
                properties: {
                    markdown: { type: 'string' },
                    html: {
                        type: 'string',
                        description:
                            'Semantic HTML with no h1, no class but language-* on code and no style.',
                    },
                },
            },
            toc: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'text', 'level'],
                    properties: {
                        id: { type: 'string' },
                        text: { type: 'string' },
                        level: { type: 'integer', minimum: 2, maximum: 6 },
                    },
                },
            },
            faq: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['question', 'answer'],
                    properties: {
                        question: { type: 'string' },
                        answer: { type: 'string' },
                    },
                },
            },
            sources: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['title', 'url'],
                    properties: {
                        title: { type: 'string' },
                        url: { type: 'string' },
                    },
                },
            },
            tags: { type: 'array', items: { type: 'string' } },
            primaryTag: nullable({ type: 'string' }),
            author: nullable({
                type: 'object',
                required: ['name', 'jobTitle', 'url', 'sameAs'],
                properties: {
                    name: { type: 'string' },
                    jobTitle: nullable({ type: 'string' }),
                    url: nullable({ type: 'string' }),
                    sameAs: { type: 'array', items: { type: 'string' } },
                },
            }),
            publisher: {
                type: 'object',
                required: ['name', 'url', 'logo', 'sameAs'],
                properties: {
                    name: { type: 'string' },
                    url: nullable({ type: 'string' }),
                    logo: nullable({
                        type: 'object',
                        required: ['url', 'width', 'height'],
                        properties: {
                            url: { type: 'string' },
                            width: { type: 'integer' },
                            height: { type: 'integer' },
                        },
                    }),
                    sameAs: { type: 'array', items: { type: 'string' } },
                },
            },
            breadcrumbs: {
                type: 'array',
                description:
                    "The locale's home, the kind's address when the kind has a URL prefix, and the page.",
                items: nameAndUrl,
            },
            publishedAt: { ...date, description: 'The first publication.' },
            updatedAt: {
                ...date,
                description:
                    'The last publication that changed the title, the body or the FAQ.',
            },
            readingMinutes: { type: 'integer', minimum: 1 },
            wordCount: { type: 'integer' },
            openGraph: {
                type: 'object',
                required: [
                    'title',
                    'description',
                    'type',
                    'url',
                    'locale',
                    'siteName',
                    'publishedTime',
                    'modifiedTime',
                ],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    type: { type: 'string', enum: ['article'] },
                    url: { type: 'string' },
                    locale: { type: 'string' },
                    siteName: { type: 'string' },
                    publishedTime: date,
                    modifiedTime: date,
                },
            },
            jsonLd: {
                type: 'object',
                description:
                    'Ready JSON-LD for <script type="application/ld+json">: an Article and the BreadcrumbList.',
            },
        },
    },
    PageList: {
        type: 'object',
        required: ['pages', 'nextCursor'],
        properties: {
            pages: {
                type: 'array',
                description:
                    'Page objects; a sync also holds removal records, told apart by status.',
                items: {
                    oneOf: [
                        { $ref: '#/components/schemas/PageObject' },
                        { $ref: '#/components/schemas/RemovalRecord' },
                    ],
                },
            },
            nextCursor: nullable({ type: 'string' }),
            nextSyncToken: nullable({
                type: 'string',
                description:
                    'Only in a sync: the token of the next sync, on its last page.',
            }),
        },
    },
};

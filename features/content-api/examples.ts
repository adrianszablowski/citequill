import { apiUrl } from '@/features/content-api/urls';

export const proxyMinutes = 5;

export function examples(siteId: string, locale = 'en') {
    const site = apiUrl(`/sites/${siteId}`);

    return [
        {
            id: 'curl',
            title: 'The first request',
            language: 'shell',
            code: `curl ${site}/pages \\
  -H "Authorization: Bearer $CITEQUILL_KEY"`,
        },
        {
            id: 'nextjs',
            title: 'Next.js, when a page is requested',
            language: 'tsx',
            code: `// app/blog/[slug]/page.tsx, in an app without Cache Components. Keep
// loading.tsx and <Suspense> out of the layouts above it, so the status is
// set before the page streams.
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { notFound, permanentRedirect } from 'next/navigation';

const site = '${site}';
const neverPublished = 'Citequill has never published this page.';

// Keeps a 200 or a 410 for ${proxyMinutes} minutes, so a 410 replaces a kept page.
// A 404 or a failure throws and is never kept: a new page shows at once, and
// an outage keeps the last answer.
const readAnswer = unstable_cache(
    async (slug: string) => {
        const response = await fetch(\`\${site}/pages/${locale}/\${encodeURIComponent(slug)}\`, {
            headers: { Authorization: \`Bearer \${process.env.CITEQUILL_KEY}\` },
            cache: 'no-store',
        });

        if (response.status === 404) {
            throw new Error(neverPublished);
        }

        if (response.status !== 200 && response.status !== 410) {
            // Citequill or the key failed, and the page is not gone.
            throw new Error(\`Citequill answered \${response.status}.\`);
        }

        return { status: response.status, body: await response.json() };
    },
    ['citequill-page'],
    { revalidate: ${proxyMinutes * 60} },
);

async function readPage(slug: string) {
    const { status, body } = await readAnswer(slug).catch((error: Error) => {
        if (error.message === neverPublished) {
            notFound();
        }

        throw error;
    });

    if (status === 410) {
        // A 308 and a 404 here; proxy.ts answers the 301 and the 410.
        return body.redirect ? permanentRedirect(body.redirect.to) : notFound();
    }

    return body;
}

export async function generateMetadata({
    params,
}: PageProps<'/blog/[slug]'>): Promise<Metadata> {
    const page = await readPage((await params).slug);

    return {
        title: page.metaTitle,
        description: page.metaDescription,
        alternates: {
            canonical: page.canonical,
            languages: Object.fromEntries(
                page.alternates.map(
                    ({ hreflang, url }: { hreflang: string; url: string }) => [
                        hreflang,
                        url,
                    ],
                ),
            ),
        },
        openGraph: page.openGraph,
    };
}

export default async function Page({ params }: PageProps<'/blog/[slug]'>) {
    const page = await readPage((await params).slug);
    const jsonLd = JSON.stringify(page.jsonLd).replace(/</g, '\\\\u003c');

    return (
        <article>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: jsonLd }}
            />
            <h1>{page.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: page.body.html }} />
        </article>
    );
}`,
        },
        {
            id: 'nextjs-proxy',
            title: 'Next.js, the proxy that answers an unpublished page',
            language: 'ts',
            code: `// proxy.ts, beside app/. It reads the unpublished pages every ${proxyMinutes} minutes
// and answers them with a 301 or a 410 before the page renders.
import { type NextRequest, NextResponse } from 'next/server';

const site = '${site}';
const headers = { Authorization: \`Bearer \${process.env.CITEQUILL_KEY}\` };

let removed = new Map<string, string | null>();
let readAt = 0;

export async function proxy(request: NextRequest) {
    if (Date.now() - readAt > ${proxyMinutes} * 60 * 1000) {
        readAt = Date.now();
        // A failed read keeps the last set, and the page still answers.
        removed = await readRemoved().catch(() => removed);
    }

    const to = removed.get(request.nextUrl.pathname);

    if (to) {
        return NextResponse.redirect(to, 301);
    }

    if (to === null) {
        return new NextResponse('Gone', { status: 410 });
    }
}

async function readRemoved() {
    const read = new Map<string, string | null>();
    let cursor = '';

    do {
        const query = cursor ? \`?cursor=\${encodeURIComponent(cursor)}\` : '';
        const response = await fetch(\`\${site}/redirects\${query}\`, {
            headers,
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            throw new Error(\`Citequill answered \${response.status}.\`);
        }

        const body = await response.json();

        for (const record of body.redirects) {
            read.set(record.path, record.redirect?.to ?? null);
        }

        cursor = body.nextCursor;
    } while (cursor);

    return read;
}

export const config = { matcher: '/blog/:slug' };`,
        },
        {
            id: 'php',
            title: 'PHP, when a page is requested',
            language: 'php',
            code: `<?php
$site = '${site}';
$key = "citequill/${locale}/$slug";
// APCu keeps a 200 or a 410 for 5 minutes. Without it, every visit asks Citequill.
$cached = function_exists('apcu_fetch') ? apcu_fetch($key) : false;

if ($cached) {
    [$status, $body] = $cached;
} else {
    $context = stream_context_create(['http' => [
        'header' => 'Authorization: Bearer ' . getenv('CITEQUILL_KEY'),
        'ignore_errors' => true,
        'timeout' => 10,
    ]]);
    $body = file_get_contents("$site/pages/${locale}/" . rawurlencode($slug), false, $context);
    $status = 0;

    if ($body !== false) {
        $headers = function_exists('http_get_last_response_headers')
            ? http_get_last_response_headers()
            : $http_response_header;
        $status = (int) explode(' ', $headers[0])[1];
    }

    if (($status === 200 || $status === 410) && function_exists('apcu_store')) {
        apcu_store($key, [$status, $body], 300);
    }
}

if ($status === 410) {
    $problem = json_decode($body, true);

    if ($problem['redirect']) {
        header('Location: ' . $problem['redirect']['to'], true, 301);
    } else {
        http_response_code(410);
    }

    exit;
}

if ($status === 404) {
    http_response_code(404);
    exit;
}

if ($status !== 200) {
    // Citequill or the key failed, and the page is not gone.
    http_response_code(503);
    exit;
}

$page = json_decode($body, true);
?>
<h1><?= htmlspecialchars($page['title']) ?></h1>
<?= $page['body']['html'] ?>`,
        },
        {
            id: 'python',
            title: 'Python, when a page is requested',
            language: 'python',
            code: `import http.client
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "${site}"
KEPT = {}


def read_page(locale, slug):
    """Returns the status and the body: a page on 200, the problem on 410.

    Keeps a 200 or a 410 for 5 minutes in this process, so a repeat visit in
    that time does not ask Citequill.
    """
    kept = KEPT.get((locale, slug))

    if kept and time.monotonic() - kept[0] < 300:
        return kept[1]

    request = urllib.request.Request(
        f"{SITE}/pages/{locale}/{urllib.parse.quote(slug)}",
        headers={"Authorization": f"Bearer {os.environ['CITEQUILL_KEY']}"},
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = response.status, json.load(response)
    except urllib.error.HTTPError as error:
        result = error.code, json.load(error) if error.code == 410 else None
    except (OSError, http.client.HTTPException, ValueError):
        return 0, None

    if result[0] in (200, 410):
        KEPT[(locale, slug)] = time.monotonic(), result

    return result


def answer(locale, slug):
    """Returns the status, the headers and the page your template renders."""
    status, body = read_page(locale, slug)

    if status == 200:
        return 200, {}, body

    if status == 410:
        redirect = body["redirect"]

        if redirect:
            return 301, {"Location": redirect["to"]}, None

        return 410, {}, None

    if status == 404:
        return 404, {}, None

    # Citequill or the key failed, and the page is not gone.
    return 503, {}, None


status, headers, page = answer("${locale}", "first-post")`,
        },
        {
            id: 'build',
            title: 'A build that keeps a copy of the pages',
            language: 'js',
            code: `// sync.mjs, run before the build; keep pages.json between builds
import { readFile, writeFile } from 'node:fs/promises';

const pagesUrl = '${site}/pages';
const headers = { Authorization: \`Bearer \${process.env.CITEQUILL_KEY}\` };
const saved = await readFile('pages.json', 'utf8').catch(() => '{"pages":{}}');
const state = JSON.parse(saved);

let sync = state.token ?? 'start';
let cursor = null;

for (;;) {
    const query = new URLSearchParams({ sync });

    if (cursor) {
        query.set('cursor', cursor);
    }

    const response = await fetch(\`\${pagesUrl}?\${query}\`, { headers });

    if (response.status === 410 && sync !== 'start') {
        state.pages = {};
        sync = 'start';
        cursor = null;
        continue;
    }

    if (!response.ok) {
        throw new Error(\`Citequill answered \${response.status}.\`);
    }

    const body = await response.json();

    for (const page of body.pages) {
        if (page.status === 'published') {
            state.pages[page.id] = page;
        } else {
            delete state.pages[page.id];
        }
    }

    if (!body.nextCursor) {
        state.token = body.nextSyncToken;
        break;
    }

    cursor = body.nextCursor;
}

await writeFile('pages.json', JSON.stringify(state));`,
        },
    ];
}

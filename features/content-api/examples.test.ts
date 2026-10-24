import { compileFunction } from 'node:vm';

import * as nextServer from 'next/server';
import type { NextRequest } from 'next/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { examples, proxyMinutes } from '@/features/content-api/examples';

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
});

describe('examples', () => {
    it("fills the project's site id into every example", () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://citequill.com');

        for (const example of examples('abc123')) {
            expect(example.code).toContain(
                'https://citequill.com/api/v1/sites/abc123',
            );
        }

        vi.unstubAllEnvs();
    });

    it('reads the key from the server and never writes one into the code', () => {
        for (const example of examples('abc123')) {
            expect(example.code).toContain('CITEQUILL_KEY');
            expect(example.code).not.toContain('cq_sk_');
        }
    });

    it("asks for a page in the project's main locale", () => {
        const php = examples('abc123', 'pl').find(({ id }) => id === 'php');

        expect(php?.code).toContain('/pages/pl/');
    });

    it('answers 404 only on 404, 410 or a 301 only on 410, and 503 on any other status', () => {
        const branches = {
            php: [
                /\$status === 404\) \{\s+http_response_code\(404\)/,
                /\$status === 410\) \{[\s\S]+?true, 301\)[\s\S]+?http_response_code\(410\)/,
                /\$status !== 200\) \{[\s\S]+?http_response_code\(503\)/,
            ],
            python: [
                /status == 404:\s+return 404,/,
                /status == 410:[\s\S]+?return 301, \{"Location"[\s\S]+?return 410,/,
                /return 503,/,
            ],
        };

        const notFound: Record<string, RegExp> = {
            php: /http_response_code\(404\)/g,
            python: /return 404,/g,
        };

        for (const [id, patterns] of Object.entries(branches)) {
            const code = example(id);

            for (const pattern of patterns) {
                expect(code).toMatch(pattern);
            }

            expect(code.match(notFound[id])).toHaveLength(1);
        }
    });

    it('keeps a 200 or a 410 for 5 minutes in PHP and Python, and never an outage', () => {
        expect(example('php')).toMatch(
            /if \(\(\$status === 200 \|\| \$status === 410\) && function_exists\('apcu_store'\)\) \{\s+apcu_store\(\$key, \[\$status, \$body\], 300\);/,
        );

        expect(example('python')).toMatch(
            /if result\[0\] in \(200, 410\):\s+KEPT\[\(locale, slug\)\] = time\.monotonic\(\), result/,
        );

        expect(example('python')).toMatch(/kept\[0\] < 300:/);
    });

    it('answers 503 in Python when Citequill cannot be reached, drops the connection, answers no JSON or does not answer in time', () => {
        expect(example('python')).toMatch(
            /except urllib\.error\.HTTPError as error:[\s\S]+?except \(OSError, http\.client\.HTTPException, ValueError\):\s+return 0, None/,
        );
    });

    it('gives up on Citequill after 10 seconds in PHP and Python, and after 5 in the Next.js proxy', () => {
        expect(example('php')).toContain("'timeout' => 10,");
        expect(example('python')).toContain('urlopen(request, timeout=10)');
        expect(example('nextjs-proxy')).toContain('AbortSignal.timeout(5000)');
    });

    it('reads the status line in PHP through http_get_last_response_headers() where it exists', () => {
        expect(example('php')).toMatch(
            /function_exists\('http_get_last_response_headers'\)\s+\? http_get_last_response_headers\(\)\s+: \$http_response_header;/,
        );
    });
});

type Read = (slug: string) => Promise<unknown>;

describe('the Next.js page', () => {
    const navigation = {
        notFound: () => {
            throw new Error('404');
        },
        permanentRedirect: (to: string) => {
            throw new Error(`308 ${to}`);
        },
    };

    function load(...answers: (Response | Error)[]) {
        const cached = vi.fn<
            (read: Read, keyParts: string[], options: object) => Read
        >((read) => read);

        const fetch = answering(answers);

        vi.stubGlobal('fetch', fetch);
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://citequill.com');

        const page = run<{
            generateMetadata: (props: {
                params: Promise<{ slug: string }>;
            }) => Promise<{ title: string }>;
        }>(example('nextjs'), {
            'next/cache': { unstable_cache: cached },
            'next/navigation': navigation,
            'react/jsx-runtime': jsxRuntime,
        });

        const [read, keyParts, options] = cached.mock.calls[0];

        return {
            fetch,
            keyParts,
            options,
            read,
            title: async () =>
                (
                    await page.generateMetadata({
                        params: Promise.resolve({ slug: 'first-post' }),
                    })
                ).title,
        };
    }

    it('keeps the status with the body for 5 minutes, and fetches with no cache of its own, so a 410 replaces a kept 200', async () => {
        const page = load(
            json(200, { metaTitle: 'First post', alternates: [] }),
        );

        expect(page.keyParts).toEqual(['citequill-page']);
        expect(page.options).toEqual({ revalidate: proxyMinutes * 60 });
        await expect(page.title()).resolves.toBe('First post');

        expect(page.fetch).toHaveBeenCalledWith(
            'https://citequill.com/api/v1/sites/abc123/pages/en/first-post',
            expect.objectContaining({ cache: 'no-store' }),
        );

        const gone = load(json(410, { redirect: null }));

        await expect(gone.read('first-post')).resolves.toEqual({
            status: 410,
            body: { redirect: null },
        });
    });

    it('answers a 410 with a 308 to the redirect, or a 404 when there is none', async () => {
        const target = 'https://acme.com/blog/new';

        await expect(
            load(json(410, { redirect: { status: 301, to: target } })).title(),
        ).rejects.toThrow(`308 ${target}`);

        await expect(
            load(json(410, { redirect: null })).title(),
        ).rejects.toThrow('404');
    });

    it('throws on a 404 inside the kept read, so a page published later shows at once, and answers it with a 404', async () => {
        await expect(load(json(404, {})).read('first-post')).rejects.toThrow();
        await expect(load(json(404, {})).title()).rejects.toThrow('404');
    });

    it('throws on any other status or a failed request and never answers 404, so an outage keeps the last kept answer', async () => {
        for (const answer of [
            json(401, {}),
            new Response('DEPLOYMENT_PAUSED', { status: 503 }),
            new TypeError('fetch failed'),
        ]) {
            const page = load(answer);

            await expect(page.read('first-post')).rejects.not.toThrow('404');
            await expect(load(answer).title()).rejects.not.toThrow('404');
        }
    });
});

describe('the Next.js proxy', () => {
    const minute = 60 * 1000;

    function load(...answers: (Response | Error)[]) {
        const fetch = answering(answers);

        vi.stubGlobal('fetch', fetch);
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://citequill.com');
        vi.stubEnv('CITEQUILL_KEY', 'cq_sk_test');

        const { proxy } = run<{
            proxy: (request: NextRequest) => Promise<Response | undefined>;
        }>(example('nextjs-proxy'), {
            'next/server': nextServer,
        });

        return {
            fetch,
            answer: async (path: string) => {
                const response = await proxy(
                    new nextServer.NextRequest(`https://acme.com${path}`),
                );

                return response
                    ? `${response.status} ${response.headers.get('location') ?? ''}`.trim()
                    : 'through';
            },
        };
    }

    function removed(...paths: [path: string, to: string | null][]) {
        return json(200, {
            redirects: paths.map(([path, to]) => ({
                path,
                redirect: to && { status: 301, to },
            })),
            nextCursor: null,
        });
    }

    it('reads every page of /redirects with the key, and answers a 301, a 410 or lets the request through', async () => {
        const proxy = load(
            json(200, {
                redirects: [
                    {
                        path: '/blog/old',
                        redirect: {
                            status: 301,
                            to: 'https://acme.com/blog/new',
                        },
                    },
                ],
                nextCursor: 'next page',
            }),
            removed(['/blog/removed', null]),
        );

        expect(await proxy.answer('/blog/old')).toBe(
            '301 https://acme.com/blog/new',
        );

        expect(await proxy.answer('/blog/removed')).toBe('410');
        expect(await proxy.answer('/blog/live')).toBe('through');

        expect(proxy.fetch.mock.calls.map(([url]) => url)).toEqual([
            'https://citequill.com/api/v1/sites/abc123/redirects',
            'https://citequill.com/api/v1/sites/abc123/redirects?cursor=next%20page',
        ]);

        expect(proxy.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: { Authorization: 'Bearer cq_sk_test' },
            }),
        );
    });

    it(`reads once for requests that arrive together, and again only after ${proxyMinutes} minutes`, async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const proxy = load(removed(['/blog/old', null]), removed());

        await Promise.all([proxy.answer('/blog/a'), proxy.answer('/blog/b')]);

        expect(proxy.fetch).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(proxyMinutes * minute);

        expect(await proxy.answer('/blog/old')).toBe('410');

        vi.advanceTimersByTime(1);

        expect(await proxy.answer('/blog/old')).toBe('through');
        expect(proxy.fetch).toHaveBeenCalledTimes(2);
    });

    it('keeps the last set when a read fails, and lets every request through when the first read fails', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const proxy = load(
            removed(['/blog/old', null]),
            new Response('DEPLOYMENT_PAUSED', { status: 503 }),
        );

        await proxy.answer('/blog/a');
        vi.advanceTimersByTime(proxyMinutes * minute + 1);

        expect(await proxy.answer('/blog/old')).toBe('410');

        const failed = load(new TypeError('fetch failed'));

        expect(await failed.answer('/blog/old')).toBe('through');
        expect(await failed.answer('/blog/old')).toBe('through');
        expect(failed.fetch).toHaveBeenCalledTimes(1);
    });
});

function example(id: string) {
    return examples('abc123').find((item) => item.id === id)?.code ?? '';
}

function answering(answers: (Response | Error)[]) {
    return vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
        async () => {
            const answer = answers.shift() ?? new Error('No answer left.');

            if (answer instanceof Error) {
                throw answer;
            }

            return answer;
        },
    );
}

function json(status: number, body: object) {
    return new Response(JSON.stringify(body), { status });
}

function run<Exports>(code: string, modules: Record<string, unknown>) {
    const { outputText } = ts.transpileModule(code, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
        },
    });

    const loaded = { exports: {} };

    compileFunction(outputText, ['require', 'exports', 'module'])(
        (id: string) => modules[id],
        loaded.exports,
        loaded,
    );

    return loaded.exports as Exports;
}

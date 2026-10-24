import type { Metadata } from 'next';
import Link from 'next/link';

import { problems } from '@/features/content-api/answer';
import { apiCacheLife } from '@/features/content-api/cache';
import { examples, proxyMinutes } from '@/features/content-api/examples';
import { hintCharacters } from '@/features/content-api/key';
import {
    longLimits,
    pageLimits,
    syncTokenDays,
} from '@/features/content-api/paging';
import { keysPerProject } from '@/features/content-api/schema';
import { apiUrl, hostSitemapUrl } from '@/features/content-api/urls';
import { formatCount } from '@/lib/utils';

export const metadata: Metadata = {
    title: 'Content API, Citequill',
    description:
        'How a site reads the pages Citequill publishes: keys, recipes, the page object, sync, sitemaps and errors.',
};

export default function DocsPage() {
    const [curl, nextjs, nextjsProxy, php, python, build] =
        examples('YOUR_SITE_ID');

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-12 text-base/7">
            <header className="flex flex-col gap-3">
                <h1 className="text-3xl font-semibold">Content API</h1>
                <p>
                    Citequill keeps the pages it writes for your site. Your site
                    reads the live ones from the Content API, from its server or
                    its build, and renders them in its own template.
                </p>
                <p>
                    Every request carries a key in the Authorization header,
                    except the XML sitemaps and the OpenAPI document. The API
                    sends no CORS headers, so a browser cannot read its answers.
                    Keep the key on your server.
                </p>
                <Link
                    href="/docs/reference"
                    className="underline underline-offset-4"
                >
                    The reference of every endpoint and field
                </Link>
            </header>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">The first request</h2>
                <p>
                    Make a key in Settings, Integration, and put it in
                    CITEQUILL_KEY on your server. The same page shows your site
                    id and every example below with it filled in.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{curl.code}</code>
                </pre>
                <p>
                    The answer is <code>{'{ pages, nextCursor }'}</code>: the
                    live pages, newest first publication first,{' '}
                    {pageLimits.fallback} at a time. Every path of your site
                    starts with <code>{apiUrl('/sites/{siteId}')}</code>.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Keys</h2>
                <p>
                    A project has up to {keysPerProject} keys, each with a name
                    such as Production or Preview. Citequill shows a key in full
                    once, when you make it. After that it shows the key&apos;s
                    prefix and last {hintCharacters} characters, and the day it
                    was last used.
                </p>
                <p>
                    Deleting a key stops it at once. To change a key, make a new
                    one, switch your site to it, then delete the old one. Both
                    work in between. A key reads only its own project.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    A site that renders a page when it is requested
                </h2>
                <p>
                    Server code reads the page when a visitor asks for it, by
                    its locale and slug. Each example renders a live page and
                    answers 404 when the API answers 404. In PHP and Python, an
                    unpublished page gets a 301 or a 410, as the API says.
                </p>
                <p>
                    A Next.js page cannot answer 410. Alone, it answers an
                    unpublished page with a 404, or with a 308 to the new
                    address, which search engines treat as a 301. It keeps the
                    answer for a live or an unpublished page for {proxyMinutes}{' '}
                    minutes. So a page can show for that long after it is
                    unpublished, and to one more visitor while the answer
                    refreshes.
                </p>
                <p>
                    The proxy beside it adds the 410 and the 301. On each server
                    it reads the unpublished pages at most every {proxyMinutes}{' '}
                    minutes, when a request comes. Until its next read, a page
                    published again still gets the 301 or the 410.
                </p>
                <p>
                    Any other answer means Citequill or the key failed. PHP and
                    Python then answer 503. The Next.js page keeps showing the
                    answer it kept, or answers 500 for a page it never kept.
                    Search engines keep the page for a while, where a 404 would
                    remove it.
                </p>
                {[nextjs, nextjsProxy, php, python].map((example) => (
                    <div key={example.id} className="flex flex-col gap-2">
                        <h3 className="font-medium">{example.title}</h3>
                        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                            <code>{example.code}</code>
                        </pre>
                    </div>
                ))}
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    A site built ahead of time
                </h2>
                <p>
                    A build that keeps a copy of the pages asks for what changed
                    since its last build. The first sync is{' '}
                    <code>?sync=start</code>, or <code>?updatedSince=</code> and
                    a date to start from one. Its last page carries{' '}
                    <code>nextSyncToken</code>, which the next build sends as{' '}
                    <code>?sync=</code> and the token.
                </p>
                <p>
                    A sync holds every page that changed, once, as it is now. A
                    live page comes as a page object, and an unpublished one as
                    a removal record. Tell them apart by <code>status</code>. A
                    page may come again in the next sync, so key pages by{' '}
                    <code>id</code>. A token lasts {syncTokenDays} days. After
                    that the sync answers 410, and the build syncs again from
                    the start.
                </p>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{build.code}</code>
                </pre>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Hosted builders</h2>
                <p>
                    Shopify, Wix and Webflow render from their own CMS, and
                    their templates cannot call the Content API. Neither can a
                    WordPress site without PHP of its own in its theme or a
                    plugin, or a plain HTML site with no build step. Pushing
                    pages into these platforms is in Citequill&apos;s backlog,
                    so today they cannot show Citequill&apos;s pages.
                </p>
                <p>
                    Some sites on such a platform also run a front end of their
                    own, such as Next.js in front of Shopify. They use the
                    recipes above.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">What a template shows</h2>
                <p>
                    A page object holds every value a template needs, ready to
                    print. The template computes nothing itself.
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-5">
                    <li>
                        <code>body.html</code> inside a wrapper that styles it,
                        the way <code>prose</code> does, or{' '}
                        <code>body.markdown</code> through a renderer of your
                        own
                    </li>
                    <li>
                        <code>faq</code> and <code>sources</code> after the
                        body, where the template wants them, because the body
                        holds neither
                    </li>
                    <li>
                        <code>jsonLd</code> in a{' '}
                        <code>{'<script type="application/ld+json">'}</code>,{' '}
                        <code>alternates</code> in{' '}
                        <code>{'<link rel="alternate" hreflang>'}</code> tags
                        and <code>openGraph</code> in{' '}
                        <code>{'<meta property>'}</code> tags
                    </li>
                    <li>
                        <code>{'<'}</code> written as <code>\u003c</code> in{' '}
                        <code>jsonLd</code>, so no value can close the script
                        tag
                    </li>
                    <li>
                        <code>title</code> as the H1, the byline linked to{' '}
                        <code>author.url</code>, <code>publishedAt</code>,{' '}
                        <code>updatedAt</code> when it differs, and{' '}
                        <code>breadcrumbs</code>, so the page shows what the
                        JSON-LD says
                    </li>
                </ul>
                <p>
                    A page has no image, so the template keeps its own{' '}
                    <code>og:image</code>. The HTML has no <code>h1</code>, no
                    class but <code>language-*</code> on code, no style and no{' '}
                    <code>rel</code> or <code>target</code> on links. A heading
                    has an id, so a link to <code>#heading</code> works, and{' '}
                    <code>toc</code> lists the headings for a table of contents.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">
                    How to answer an unpublished page
                </h2>
                <p>
                    A page asked for by its locale and slug after it was
                    unpublished answers 410, with <code>redirect</code> beside
                    the error. Answer your visitor with a 301 to{' '}
                    <code>redirect.to</code>, or with 410 when{' '}
                    <code>redirect</code> is null. A page that was never
                    published answers 404.
                </p>
                <p>
                    <code>/redirects</code> lists a removal record for every
                    unpublished page, for a site that writes its redirects at
                    build time. An unpublished page is in neither the list nor
                    the sitemaps.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Lists and pages</h2>
                <p>
                    <code>/pages</code> takes <code>locale</code>,{' '}
                    <code>kind</code> and <code>limit</code>,{' '}
                    {pageLimits.fallback} by default and {pageLimits.max} at
                    most. <code>/redirects</code> and <code>/sitemap</code> take{' '}
                    <code>limit</code>, {formatCount(longLimits.fallback)} by
                    default and {formatCount(longLimits.max)} at most. A larger
                    limit counts as the maximum.
                </p>
                <p>
                    When more items follow, the answer carries{' '}
                    <code>nextCursor</code>, and the next page&apos;s address in
                    a <code>{'Link: <…>; rel="next"'}</code> header. Send the
                    cursor back as it came, with the same filters. A parameter
                    the endpoint does not take answers 400.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">The XML sitemap</h2>
                <p>
                    Citequill keeps a ready sitemap of the live pages for each
                    host of your site, with no key. Name it in the robots.txt of
                    that host, and Google finds the pages with no sitemap code
                    on your site:
                </p>
                <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`Sitemap: ${hostSitemapUrl('YOUR_SITE_ID', 'www.yoursite.com')}`}</code>
                </pre>
                <p>
                    When a host has more pages than one file holds, the sitemap
                    is an index of its files. A site that builds its own sitemap
                    merges <code>/sitemap</code> into it instead.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Caching</h2>
                <p>
                    Every answer under <code>/sites</code> carries{' '}
                    <code>Cache-Control: private, no-cache</code> and an{' '}
                    <code>ETag</code>. Send the ETag back in{' '}
                    <code>If-None-Match</code>, and an answer that has not
                    changed comes back as 304 with no body. A single page also
                    carries <code>Last-Modified</code>.
                </p>
                <p>
                    Every request runs on Citequill&apos;s side, so keep your
                    own copy and ask no more often than every few minutes.
                    Citequill clears its own cache after a change: when a page
                    is published or unpublished, and when an edit in Settings or
                    a new crawl changes what a page shows. If a clear fails, an
                    answer is never more than {apiCacheLife.expire / 60} minutes
                    older than the change.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Formats</h2>
                <p>
                    Dates are RFC 3339 in UTC with 3 fractional digits, such as{' '}
                    <code>2026-10-15T06:12:00.000Z</code>. A locale is a
                    language, or a language and a two-letter country, such as{' '}
                    <code>pl</code> or <code>en-US</code>. Field names are
                    camelCase. Ignore a field or a value you do not know.
                    Version 1 only gains fields, endpoints, values and optional
                    parameters. A removal or a change of meaning comes in
                    version 2.
                </p>
            </section>
            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold">Errors</h2>
                <p>
                    An error is an RFC 9457 problem, with <code>type</code>,{' '}
                    <code>title</code>, <code>status</code>, <code>detail</code>{' '}
                    and <code>code</code>. Branch on <code>code</code>. The{' '}
                    <code>detail</code> is for people and may change.
                </p>
                <dl className="flex flex-col gap-3">
                    {Object.entries(problems).map(([code, problem]) => (
                        <div key={code} id={code} className="flex flex-col">
                            <dt>
                                <code>{code}</code>, {problem.status}
                            </dt>
                            <dd className="text-muted-foreground">
                                {problem.detail}
                            </dd>
                        </div>
                    ))}
                </dl>
                <p>
                    Vercel, which runs Citequill, may answer 429 or 503 before
                    the API does, with a body of its own. Wait, then send the
                    request again.
                </p>
            </section>
        </main>
    );
}

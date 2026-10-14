# Rendering a hosted content feed on a customer's Next.js site on Vercel

Research date: 13 October 2026. Digest of a sub-agent report. "Official" means Next.js, Vercel, Google, IndexNow or Anthropic docs.

## Premises checked

| Premise | Verdict | Source |
| --- | --- | --- |
| Edge runtime deprecated | True. Not supported from Next.js 16.3 | https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime, https://vercel.com/docs/functions/runtimes/edge |
| Fluid compute default | True for projects created after 23 April 2025 | https://vercel.com/docs/fluid-compute |
| Function timeout | Default 300 s on every plan. Max 300 s Hobby, 800 s Pro, 1,800 s beta | https://vercel.com/docs/functions/limitations |
| Workflow, Queues, Sandbox | Workflow likely GA (secondary source), Queues public beta, Sandbox GA since 30 January 2026 | https://vercel.com/docs/workflows, https://vercel.com/docs/queues, https://vercel.com/blog/vercel-sandbox-is-now-generally-available |

## Rendering patterns

Recommendation: on-demand revalidation (revalidateTag from our webhook) with a long time-based fallback. Avoid force-dynamic on every request.

- New Next.js 16 apps have Cache Components on by default. With it, `dynamic`, `revalidate` and `fetchCache` segment exports are removed. Any file we ship must work in 2 models: previous (`revalidate`, tagged `fetch`) and Cache Components (`'use cache'`, `cacheLife`, `cacheTag`). https://nextjs.org/docs/app/getting-started/caching
- `revalidateTag(tag, 'max')` in a Route Handler marks data stale; next request serves stale and regenerates in background. Single-argument form is deprecated. `updateTag` works only in Server Actions. https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- Regeneration is lazy: "A revalidation is triggered by a request, not by the revalidateTag call". After our webhook we must fetch the page once before pinging IndexNow.
- On-demand revalidation affects only the domain and deployment called. https://vercel.com/docs/incremental-static-regeneration
- Vercel ISR: failed regeneration (5xx, network) keeps the stale page and retries after 30 s. 404 and 410 count as success, so never map an API timeout to notFound(). Cache persists until revalidated or unaccessed 31 days; each deployment has its own cache.
- force-dynamic: every crawler hit is a function call plus our API call; no stale copy; our outage means 500s to Googlebot, which slows crawl and drops URLs. https://developers.google.com/search/docs/crawling-indexing/http-network-errors
- Vercel recommends tag-based revalidation for CMS publish events. https://vercel.com/docs/incremental-static-regeneration/quickstart, https://vercel.com/kb/guide/how-to-move-to-on-demand-revalidation
- Sanity's own pattern: tagged fetch, cache lives until a signed webhook calls revalidateTag. https://www.sanity.io/docs/nextjs/caching-and-revalidation-in-nextjs

## A package cannot add routes by itself

Confirmed. App Router maps URLs to files. Every drop-in (Payload, Fumadocs, next-intl, Nextra, Flags SDK, next-sanity) exports handlers and the customer creates thin files. Flags SDK is the pattern: one line per file, for example `export const GET = createFlagsDiscoveryEndpoint(...)`. https://vercel.com/docs/flags/flags-explorer/getting-started

Smallest file set (5 files plus the key):

| URL | File | Content |
| --- | --- | --- |
| /blog | app/blog/page.tsx | re-export of page and generateMetadata |
| /blog/[slug] | app/blog/[slug]/page.tsx | re-export; JSON-LD rendered inside |
| /blog/[slug]/md | app/blog/[slug]/md/route.ts | re-export GET; optional rewrite from /blog/:slug\\.md |
| /blog/sitemap.xml | app/blog/sitemap.ts | re-export sitemap |
| /api/autopilot/revalidate | app/api/autopilot/revalidate/route.ts | re-export POST |
| /{key}.txt | public/{key}.txt | IndexNow key, written by our CLI |

Rules: route.ts cannot share a segment with page.tsx; a folder may contain a dot (app/rss.xml/route.ts); static segments beat dynamic at the same level; public/ files are served with max-age=0. https://nextjs.org/docs/app/api-reference/file-conventions/route, https://nextjs.org/docs/app/api-reference/file-conventions/public-folder

The installer should detect `cacheComponents` and write the matching template.

## Sitemaps

- Multiple sitemaps by nesting sitemap.ts in segments or by generateSitemaps (/products/sitemap/0.xml). Next.js makes no sitemap index for you. https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
- robots.ts accepts `sitemap: string | string[]`. Google allows multiple Sitemap lines, 50,000 URLs or 50 MB per sitemap, 500 index files per site.
- A sitemap not submitted in Search Console only covers URLs under its own directory. So app/blog/sitemap.ts cannot carry pages outside /blog unless submitted in Search Console, or placed at the root (app/autopilot-sitemap.xml/route.ts). https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Unconfirmed: whether revalidateTag refreshes a tagged fetch inside sitemap.ts. Test it.

## Hreflang with next-intl

- metadata `alternates.languages` renders hreflang links; `x-default` is a valid key. Each version must list itself and every other; one-way links are ignored. Self-canonical per language. https://nextjs.org/docs/app/api-reference/functions/generate-metadata, https://developers.google.com/search/docs/specialty/international/localized-versions
- next-intl emits a Link header with hreflang by default (`alternateLinks`); our head tags must agree or the customer sets alternateLinks false. Resolve paths through `getPathname` because `localePrefix: 'as-needed'` drops the default locale prefix. https://next-intl.dev/docs/routing/configuration
- Root-level files (key, root sitemap, webhook) sit outside app/[locale]; the customer's proxy.ts matcher must exclude them.

## Weekly jobs on Vercel

| Thing | Limit | Source |
| --- | --- | --- |
| Cron | 100 per project; Hobby once a day; Pro once a minute; GET with CRON_SECRET; not retried; may overlap; production only | https://vercel.com/docs/cron-jobs/usage-and-pricing |
| Fluid function | 300 s default; 800 s Pro max; 1,800 s beta with maxDuration | https://vercel.com/docs/functions/configuring-functions/duration |
| Workflow | no run duration limit; 10,000 steps; 50 MB payload; 3 retries default; $0.02 per 1,000 events; Hobby 50,000 events free | https://vercel.com/docs/workflows/pricing |
| Queues | beta; retention up to 7 days; 100 MB messages | https://vercel.com/docs/queues |
| Sandbox | Hobby 45 min; Pro 24 h sessions; $0.128 per CPU hour; 2 h task at 10% CPU about $0.88 | https://vercel.com/docs/sandbox/pricing |

Vercel guidance: keep the cron route thin and start() a workflow. https://vercel.com/kb/guide/how-to-run-background-jobs-in-nextjs-on-vercel

Claude Agent SDK spawns a claude CLI subprocess needing disk and a shell; Anthropic suggests 1 GiB RAM, 5 GiB disk per agent. Vercel's KB shows it inside Sandbox, not in a plain function. https://code.claude.com/docs/en/agent-sdk/hosting, https://vercel.com/kb/guide/using-vercel-sandbox-claude-agent-sdk

Hobby is non-commercial only, so Pro is the floor. https://vercel.com/docs/plans/hobby

## Distribution

- Sign in with Vercel: scopes openid, profile, email, offline_access only. Project and env var permissions are private beta. https://vercel.com/docs/sign-in-with-vercel/scopes-and-permissions
- Connectable account integration: OAuth token with scopes project, project-env-vars; can POST /v9/projects/{id}/env. Community badge and install URL after the form; marketplace listing needs 500 installs. https://vercel.com/docs/integrations/create-integration/vercel-api-integrations
- Native integration needs the partner programme and a Marketplace API server. Not an MVP path.
- Deploy hooks not needed when content is fetched at request time or revalidated on demand.

## Edge cases

- Slug collision: a static app/blog/about/page.tsx shadows our [slug]. If the customer already has app/blog/[slug], our file cannot coexist; export a resolver `getAutopilotPost(slug)` they call from their own page, and check candidate slugs against the live site before generating.
- notFound() returns 404 only before streaming starts; after streaming it is 200 plus noindex (soft 404). Check existence before any Suspense boundary. https://nextjs.org/docs/app/api-reference/file-conventions/not-found
- No page-level 410 API; Google treats all 4xx except 429 the same. Use 404.
- next/image needs our host in images.remotePatterns, or serve plain img.
- Throw on API 5xx so ISR keeps the stale page. Call notFound() only on a definitive 404 from our API.
- With PPR, HTML-limited bots get a dynamic render and a 500 if a data source is down. https://nextjs.org/docs/app/getting-started/caching
- Function payload limit 4.5 MB bounds the markdown and sitemap handlers.

## Recommended shape

Ship `@autopilot/next` with a CLI that writes the 5 thin files plus the key. Previous model: `fetch` with `next: { revalidate: 86400, tags }`. Cache Components: same fetch inside `'use cache'` with `cacheLife('days')` and `cacheTag`. Webhook calls `revalidateTag(tag, 'max')`, then our side fetches the page once and pings IndexNow. Paths and hreflang via next-intl `getPathname`. Distribute as a connectable account integration that sets the API key env var. Jobs: Pro plan, thin cron starts a Workflow run; Sandbox only if a coding agent is needed.

# Content API access: keys, caching, rate limits and the database path (fetched 21 October 2026)

Every fact below comes from a page fetched on 21 October 2026, a file in this repo read the same day, or a live request we made that day. "Primary" means the specification, the vendor's own documentation, or this repo's own code. Facts already held by earlier research files are cited, not repeated.

## Summary

The findings that change the current design, most important first:

1. Vercel's CDN does not store a response to a request that carries an `Authorization` header. The design sends the key in that header, so `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` buys no CDN caching. Every request, a 304 included, is a function invocation. This corrects the line in `2026-10-14-nextjs-16-4.md` that the CDN "takes repeated reads off the function" (section 5).
2. The same header is unsafe outside Vercel. RFC 9111 lets any shared cache reuse a response to an authenticated request when it says `public` or `s-maxage`. The URL names no project, so a shared cache between a customer and us could hand one project's pages to another (section 5).
3. Vercel's cache key is the method, URL, host, deployment and scheme, and no request header unless `Vary` names it. The design is safe on Vercel today only because `Authorization` blocks storage. Moving the key to a custom header without `Vary`, or ever answering a keyless request with a cacheable 200 at the same URL, would serve one project's response to every project (section 5).
4. `proxy.ts` runs on `/api/v1`. It finds no session and redirects the request to `/login`, so the API cannot work until the matcher excludes it. Vercel runs this proxy before the cache and bills it as compute (section 7).
5. On Hobby, 1 million function invocations a month are included and they count "regardless of request success or failure". Past a limit the owner waits 30 days, and a paused deployment answers `503 DEPLOYMENT_PAUSED`. One million requests with a bad key would take down the API and the dashboard together. Hobby has one rate-limit rule per project, keyed by IP or JA4 only (section 6).
6. One key column per project cannot hold several keys, names, a last-used date or rotation with overlap. Stripe, Sanity, Strapi and Storyblok give each key a name and show it once, Supabase advises one secret key per backend component, and Stripe's rotation keeps the old key working for up to 7 days. A `site_keys` table gives overlap for free: create the new key, switch, delete the old one (sections 2 and 3).
7. A SHA-256 hash of a 256-bit random key meets NIST's rule for stored look-up secrets. NIST asks for a salted password hash only for secrets below 112 bits (section 3).
8. The pages are public on the customer's site, so the key protects the project boundary, revocation and our bill, not secrecy. Ghost calls its read key "safe for use in browsers", Sanity and Prismic serve published content with no token by default, and Prismic, Hygraph and Sanity say a token must never reach client code (section 1).
9. A 401 must carry `WWW-Authenticate`, here `Bearer realm="citequill"`, with `error="invalid_token"` when a key was sent and refused. Keys never go in a query string (section 4).
10. Unpublishing and key revocation need delete semantics. `revalidateTag(tag, 'max')` serves stale content once more; `updateTag` in a Server Action or `revalidateTag(tag, { expire: 0 })` elsewhere does not (section 5).

## 1. Threat model and how headless CMSs scope read access

The API returns only published pages, which the customer's site also shows. A key therefore guards little that is secret. What it does guard:

- the project boundary: today the key alone picks the project, so without it nobody can name a project at all
- cost: every call is a function invocation on our bill, and on Hobby a hard cap (section 6)
- revocation: when a site leaves or a key leaks, deleting the key stops that caller
- timing: a key holder can read a page in the seconds between publishing and the site's next render; the content is the same, so this matters little
- scraping convenience: a clean JSON feed of every page with `updatedSince` makes copying the content easier than crawling the site; this is our reasoning, not a sourced fact

Most of what the API returns is also on the site or answers publicly: the body, the FAQ, the JSON-LD, the sitemap. `GET /redirects` lists unpublished paths and their targets, which anyone can also learn by requesting the old URL.

Headless CMSs split into two groups. Some treat read access to published content as public: Ghost's key is browser-safe, Sanity's public datasets and Prismic's default setting need no token, and Storyblok's public token is meant for production frontends. Others keep every token secret: Prismic, Hygraph and Sanity all say a token must not reach client-side code. Several keys per project, a name, being shown once and deletion as revocation are common. Expiry and last-used dates are rarer.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Ghost Content API key in browsers | "safe for use in browsers and other insecure environments", because the keys "only ever provide access to public data" | https://docs.ghost.org/content-api | Yes |
| Ghost key transport | query parameter `?key={key}`; keys come from a Custom Integration in Ghost Admin | https://docs.ghost.org/content-api | Yes |
| Ghost caching | the API is "designed to be fully cachable" | https://docs.ghost.org/content-api | Yes |
| Contentful Delivery and Preview keys | "read-only access to one or more environments"; `master` when `environments` is not given; deleting a Delivery key deletes its Preview key | https://contentful.com/developers/docs/references/content-management-api/api-keys.md | Yes |
| Sanity public dataset | "everyone can query for content in the dataset without being authorized"; unauthenticated reads exclude every draft and release version | https://www.sanity.io/docs/content-lake/keeping-your-data-safe | Yes |
| Sanity tokens in browsers | "Never add an access token to JavaScript that is bundled for client-side use" | https://www.sanity.io/docs/content-lake/keeping-your-data-safe | Yes |
| Sanity token lifecycle | shown "exactly once"; deleting revokes it "immediately"; robot tokens last until deleted unless an expiry is set; personal tokens last one year by default; "Use descriptive names, prune unused tokens" | https://www.sanity.io/docs/content-lake/http-auth | Yes |
| Storyblok tokens | public token reads `published` content, "Use this token in production frontends"; preview token reads draft and published | https://www.storyblok.com/docs/concepts/access-tokens | Yes |
| Storyblok management tokens | named, scoped to spaces and resources, optional expiry, shown once ("the only occasion you can view it"), only the name is editable afterwards | https://www.storyblok.com/docs/concepts/access-tokens | Yes |
| Strapi API tokens | types read-only, full access, custom; name required; duration 7, 30 or 90 days or unlimited; viewable once unless an encryption key is set; `Authorization: bearer` | https://docs.strapi.io/cms/features/api-tokens | Yes |
| Prismic default access | "Public API for Master only": published content public, releases need a token | https://prismic.io/docs/access-token | Yes |
| Prismic token in browsers | "The access token is a secret. Do not use it in client-side requests" | https://prismic.io/docs/access-token | Yes |
| DatoCMS tokens | named; flags `can_access_cda`, `can_access_cda_preview` (drafts through `X-Include-Drafts`), `can_access_cma`; last use shown as coarse values such as `today`, `this_week`, `never`; a rotate endpoint; no expiry field | https://www.datocms.com/docs/content-management-api/resources/access_token.md | Yes |
| Hygraph | public API access is off for new projects, default public stage `PUBLISHED`; Permanent Auth Tokens through `Authorization: Bearer`; "not expose your PAT client-side" | https://hygraph.com/docs/api-reference/basics/authorization | Yes |
| Payload API keys | one per user document, header `{collection slug} API-Key {key}`; shown once, then masked unless `reveal` is set; non-expiring; encrypted with the server secret, not hashed | https://payloadcms.com/docs/authentication/api-keys | Yes |
| Google and JavaScript | Google says "not all bots can run JavaScript" | `docs/research/2026-10-17-seo-audit.md`, line 61 | No (earlier research) |

## 2. Key lifecycle: several keys, names, rotation and revocation

Stripe's model is the most complete. A key has a name and a note, is shown once, can be rotated with a grace period of up to 7 days, can be expired at once, and has its own request log. Stripe recommends one restricted key per service. Supabase recommends one secret key per backend component and gives a four-step rotation: create, replace, confirm, delete. GitHub's fine-grained tokens add a default 30-day expiry and remove tokens unused for a year.

When a key leaks, all three say the same thing: revoke it now and issue a new one. Stripe's "Now" option deletes the old key; Supabase says "Delete a leaked key immediately". With several keys per project, overlap needs no special grace period: the owner adds a second key, moves the site to it, then deletes the first.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Stripe key types | publishable `pk_` safe to expose; restricted `rk_` and secret `sk_` not; live and test variants `pk_live_`, `rk_test_` and so on | https://docs.stripe.com/keys | Yes |
| Stripe count | "Create as many RAKs as you want and assign them to different parts of your application" | https://docs.stripe.com/keys | Yes |
| Stripe shown once | "Save the key value. You can't retrieve it later." | https://docs.stripe.com/keys | Yes |
| Stripe names and notes | a key name, and a note for where the key is stored; both editable | https://docs.stripe.com/keys | Yes |
| Stripe rotation | "both the old and new keys work for up to 7 days"; choosing "Now" deletes the old key; rotate when a key "is compromised" | https://docs.stripe.com/keys | Yes |
| Stripe usage evidence | per-key request logs; expire the old key "only after its request volume has been at zero for a few hours or days" | https://docs.stripe.com/keys | Yes |
| Stripe access policies | a key can be limited to IP ranges, ASNs and countries | https://docs.stripe.com/keys | Yes |
| Stripe restricted keys | per-resource permission None, Read or Write; "Use one restricted key per service or use case" | https://docs.stripe.com/keys/restricted-api-keys | Yes |
| GitHub fine-grained token expiry | default 30 days; infinite allowed unless an organisation policy blocks it; "we highly recommend adding an expiration" | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens | Yes |
| GitHub unused tokens | "GitHub automatically removes personal access tokens that haven't been used in a year" | same | Yes |
| GitHub token fields | a token name and an optional description; minimal repository access and permissions advised | same | Yes |
| Supabase key types | `sb_publishable_...` and `sb_secret_...`, "short strings, not JWTs"; legacy `anon` and `service_role` JWTs | https://supabase.com/docs/guides/api/api-keys | Yes |
| Supabase secret key power | "bypasses Row Level Security, so it must never leave your control"; acts as `service_role` | https://supabase.com/docs/guides/api/api-keys | Yes |
| Supabase secret key in browsers | "A secret key doesn't work in a browser"; Supabase matches the `User-Agent` and returns 401 | https://supabase.com/docs/guides/api/api-keys | Yes |
| Supabase per component | "Use a separate secret key for each backend component" | https://supabase.com/docs/guides/api/api-keys | Yes |
| Supabase leak | "Fix the root cause of the leak before you rotate anything"; "Delete a leaked key immediately"; deletion "can't be undone" | https://supabase.com/docs/guides/api/api-keys | Yes |

## 3. Key format, scanning, entropy and storage

Prefixes exist so people and scanners can recognise a key. GitHub's prefixes cut secret-scanning false positives to an expected 0.5%, its underscore selects the whole token on a double click, and a 32-bit CRC32 checksum in the last 6 characters lets code reject a fake token without a database lookup. Supabase and Stripe keys follow the same idea, and both are GitHub partner patterns with push protection.

Joining GitHub's partner programme needs an email to GitHub, a regular expression per key type, a test account and a public endpoint that verifies GitHub's ECDSA signature. GitHub only sends matches from public sources, and the provider decides whether to revoke. A distinct prefix now keeps that door open later at no cost.

For storage, NIST says every look-up secret is stored hashed with an approved function. Only secrets shorter than the minimum security strength, 112 bits, need a salted password-hashing scheme. A 256-bit key from a secure random generator is well above both that line and OWASP's 64-bit minimum for session identifiers, so SHA-256 is enough and a slow hash would only add CPU to every request. NIST writes this for look-up secrets, not API keys by name, and states the 112-bit case by implication.

The repo already generates secrets this way: `bot_secret` is 32 random bytes in hex, made by `gen_random_bytes` in the migration default and by `randomBytes(32)` in the regenerate action.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| GitHub prefixes | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`; expected false positive rate "down to 0.5%" | https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/ (5 April 2021, updated 10 May 2023) | Yes |
| GitHub separator | `_` "will reliably select the whole token when you double click on it" and is not a Base64 character | same | Yes |
| GitHub checksum | "A 32 bit checksum in the last 6 digits of each token", CRC32 in Base62, for offline rejection of fake tokens | same | Yes |
| GitHub entropy | 30 Base62 characters, entropy raised from 160 to 178 bits "without changing the token length" | same | Yes |
| Partner programme entry | email secret-scanning@github.com; a regular expression per secret type; a test account; a public POST endpoint | https://docs.github.com/en/code-security/secret-scanning/secret-scanning-partnership-program/secret-scanning-partner-program | Yes |
| Partner payload | JSON array of `token`, `type`, `url`, `source`; signature checked with `Github-Public-Key-Signature`, ECDSA P-256 SHA-256 | same | Yes |
| Partner scope and action | matches in public sources only; treat them "as public and compromised"; revoking is the provider's choice | same | Yes |
| Recommended format | a unique prefix, high-entropy random strings and a 32-bit checksum | same | Yes |
| Push protection | blocks pushes with secrets "before they reach your repository"; on by default at user level for public repositories, off by default per repository | https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection | Yes |
| Supabase and Stripe patterns | `supabase_secret_key`, `stripe_api_key` and `stripe_live_restricted_key` are partner patterns with push protection | https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns | Yes |
| NIST storage rule | "All look-up secrets SHALL be stored in a hashed form using an approved hashing function"; secrets shorter than the minimum security strength (112 bits) go through "a suitable password hashing scheme" | https://pages.nist.gov/800-63-4/sp800-63b.html, section 3.1.2.2 | Yes |
| NIST random source | look-up secrets "SHALL use an approved random bit generator" | same, section 3.1.2.1 | Yes |
| OWASP entropy | "at least 64 bits of entropy", from "A strong CSPRNG" | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html | Yes |
| Constant-time comparison | `crypto.timingSafeEqual` compares in constant time, throws on different byte lengths, and "does not guarantee that the surrounding code is timing-safe" | `node_modules/@types/node/crypto.d.ts` (copy of the Node.js docs, 20.19.43); nodejs.org was truncated before this section | Yes (vendor docs, local copy) |
| Supabase logging | "log no more than 6 characters from the random part after its prefix" | https://supabase.com/docs/guides/api/api-keys | Yes |
| `bot_secret` generation | `encode(extensions.gen_random_bytes(32), 'hex')` as the column default; `randomBytes(32).toString('hex')` on regenerate | `supabase/migrations/20261017120000_audit.sql`, lines 11 and 12; `features/projects/actions.ts`, line 45 | Yes (repo) |
| `bot_secret` storage | stored in clear, read again by `getBotSecret()` under the owner's row level security | `docs/data-model.md`, line 19; `features/projects/queries.ts`, lines 42 to 56 | Yes (repo) |

## 4. Transport, status codes and browsers

RFC 6750 says a client "SHOULD" send a bearer token in the `Authorization` header and "SHOULD NOT" put it in a query string unless nothing else works. A token in a URL ends up in logs and browser history; OWASP says the same for API keys. A 401 must carry a `WWW-Authenticate` challenge. With no credentials the challenge carries no error code; with a refused token it says `error="invalid_token"`.

A custom header such as `X-Api-Key` is common, but it is not a standard and it changes how caches treat the request (section 5).

`Authorization` is not a CORS-safelisted header, so a browser on another origin sends a preflight `OPTIONS` first. Next.js answers `OPTIONS` itself when a route defines none, and Vercel caches only `GET` and `HEAD`, so every preflight is an invocation. Sending no CORS headers keeps browsers on other origins from reading responses at all.

A plain HTML site has no server to hold a secret key. It can fetch at build time in CI, use a server-side include if its host runs PHP or similar, or call a key that is safe to expose. Rendering the content with JavaScript in the browser is weak for SEO and GEO anyway, because not every crawler runs JavaScript (section 1).

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Header method | "Clients SHOULD make authenticated requests with a bearer token using the "Authorization" request header field" | https://www.rfc-editor.org/rfc/rfc6750.html, section 2.1 | Yes |
| Query method | "SHOULD NOT be used unless it is impossible" to use the header; not recommended "due to its security deficiencies" | same, section 2.3 | Yes |
| Tokens in URLs | "Bearer tokens SHOULD NOT be passed in page URLs" | same, section 5.3 | Yes |
| Challenge | the server "MUST include the HTTP "WWW-Authenticate" response header field"; example `Bearer realm="example", error="invalid_token"` | same, section 3 | Yes |
| No credentials | the server "SHOULD NOT include an error code or other error information" | same, section 3 | Yes |
| Error codes | `invalid_request` 400, `invalid_token` 401, `insufficient_scope` 403 | same, section 3.1 | Yes |
| 401 | "The server generating a 401 response MUST send a WWW-Authenticate header field" | https://www.rfc-editor.org/rfc/rfc9110.html, section 15.5.2 | Yes |
| 403 and 404 | 403: the server "understood the request but refuses to fulfill it"; a server that wishes to "hide" a forbidden resource may answer 404 | same, section 15.5.4 | Yes |
| OWASP on URLs | "Passwords, security tokens, and API keys should not appear in the URL" | https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html | Yes |
| OWASP on API keys | require them "for every request"; return 429 when requests come too fast; revoke a key that breaks the usage agreement | same | Yes |
| CORS safelist | `Accept`, `Accept-Language`, `Content-Language`, `Content-Type`, `Range`; `Authorization` triggers a preflight | https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS | No (MDN) |
| Next.js `OPTIONS` | "If `OPTIONS` is not defined, Next.js will automatically implement `OPTIONS`" | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, line 39 | Yes |
| Vercel cacheable methods | "Request uses `GET` or `HEAD` method" | https://vercel.com/docs/caching/cdn-cache (updated 14 September 2026) | Yes |

## 5. Caching with authentication on Vercel

This is the part of the design most in need of change.

Vercel lists the conditions a response must meet before its CDN stores it. One is "Request doesn't contain `Authorization` header". So under the current design Vercel stores nothing and every request reaches the function. `ETag` and `If-None-Match` still save bandwidth, but a 304 is computed by the function and counts as an invocation.

Vercel's cache key is the method, the URL, the host, the deployment and the scheme. Request headers join it only through `Vary`, plus `Accept` and `Accept-Encoding` by default. The current URL names no project. If any change let Vercel store a response at `/api/v1/pages`, the next project to ask that URL would get it. Two such changes are easy to make: sending the key in a custom header without `Vary`, or answering a request with no key with a cacheable 200 or 404. 401 is not on Vercel's list of cacheable statuses, which is why the current design does not leak on Vercel today.

Our live check found a nuance. A request to vercel.com's docs with a dummy `Authorization` header still got `x-vercel-cache: HIT` from an entry that already existed. So the documented condition governs storing, not reading. We could not test storing, because that needs a deployment of our own.

Outside Vercel the header protects nothing. RFC 9111 lets a shared cache reuse a response to a request with `Authorization` when the response says `public`, `s-maxage` or `must-revalidate`. The design sends two of those. Vercel strips `s-maxage` and `stale-while-revalidate` before the response leaves, but `public` stays, and `public` alone permits that reuse. A caching proxy in front of several customer sites, such as an agency's, may then reuse project A's list for project B's request to the same URL. How long it keeps the copy depends on that cache, not on us.

Vercel offers headers that target only its own cache. `Vercel-CDN-Cache-Control` controls Vercel's CDN and is never forwarded, so `Cache-Control: private` can still tell every other cache not to store. `Vary` on a request header creates a separate entry per value. Vercel refuses to cache only when `Vary` names a high-cardinality header such as `Cookie`, or `*`.

Next.js 16 with `cacheComponents` runs a GET route handler at request time once it reads request headers. It passes the handler's own `Cache-Control` through, and its CDN guide says dynamic pages get `private, no-cache, no-store`. A `'use cache'` function cannot read headers, so the key must be checked outside it and only the project id passed in. Plain `'use cache'` is in memory and "typically" lost between serverless requests; `'use cache: remote'` is shared. Neither survives a deploy. The earlier research already holds the rule that tokens never go into cache arguments (`2026-10-14-nextjs-16-4.md`, line 49).

A purge by tag on Vercel clears the CDN, the Runtime Cache and the Data Cache together. Invalidating serves the stale entry once more while it refreshes, and deleting does not. In Next.js 16, `revalidateTag(tag, 'max')` invalidates. `updateTag(tag)`, the deprecated one-argument `revalidateTag(tag)` and `revalidateTag(tag, { expire: 0 })` delete. Unpublishing and key revocation must not serve one more stale copy.

The options are compared in "Design implications".

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Storage conditions | `GET` or `HEAD`; no `Range`; "Request doesn't contain `Authorization` header"; status 200, 404, 410, 301, 302, 307 or 308; no `set-cookie`; no `private`, `no-cache` or `no-store`; no `Vary: *`; no `Vary` on a high-cardinality header | https://vercel.com/docs/caching/cdn-cache (updated 14 September 2026) | Yes |
| What enables caching | a function's `Cache-Control` with `s-maxage=N`, optionally with `stale-while-revalidate` and `stale-if-error`; `proxy-revalidate` is not supported | same | Yes |
| Cache key | request method, URL (query ignored for static files), host, deployment URL, scheme; "Cache keys are not configurable" | https://vercel.com/docs/caching/cdn-cache/purge (updated 3 September 2026) | Yes |
| `Vary` | combines the cache key with "the values of any request headers specified in the `Vary` header"; `Accept` and `Accept-Encoding` are in the key by default | https://vercel.com/docs/caching/cdn-cache | Yes |
| Refused `Vary` | `Vary: Cookie` is not cached, reason "Vary key denied"; `Vary: *` is treated as `private` | https://vercel.com/docs/caching/cdn-cache; https://vercel.com/docs/caching/cache-status (updated 15 September 2026) | Yes |
| CDN not fit | "Responses include sensitive user data"; user-specific content "without the `Vary` header" | https://vercel.com/docs/caching/cdn-cache | Yes |
| Targeted headers | `Vercel-CDN-Cache-Control` first, then `CDN-Cache-Control`, then `Cache-Control`; `Vercel-CDN-Cache-Control` is "not returned to the browser or forwarded to other CDNs" | https://vercel.com/docs/caching/cache-control-headers (updated 14 September 2026) | Yes |
| `s-maxage` stripping | with only `Cache-Control`, Vercel strips `s-maxage` before the client; with a targeted header, it forwards `Cache-Control` as is | same | Yes |
| `private` on Vercel | cached "by the client and not by Vercel's CDN"; per-user responses should use `private, max-age=0` | same | Yes |
| Default | `cache-control: public, max-age=0, must-revalidate` | same | Yes |
| Region and lifetime | the CDN cache is "segmented by region"; cache times are "best-effort and not guaranteed" | https://vercel.com/docs/caching/cdn-cache | Yes |
| Deployment scope | "Vercel scopes cached responses to the deployment that produced them" | https://vercel.com/docs/caching/cache-status | Yes |
| Live check | `GET https://vercel.com/docs/caching/cdn-cache` with `Authorization: Bearer test-not-a-real-key` answered `x-vercel-cache: HIT` twice, as did the same request without the header | our curl, 21 October 2026 | No (our check) |
| RFC 9111 section 3.5 | "A shared cache MUST NOT use a cached response to a request with an Authorization header field" unless a directive allows it; the directives named are must-revalidate, public and s-maxage | https://www.rfc-editor.org/rfc/rfc9111.html, section 3.5 | Yes |
| `public` | "permits a shared cache to reuse a response to a request containing an Authorization header field" | same, section 5.2.2.9 | Yes |
| `private` | "a shared cache MUST NOT store the response" | same, section 5.2.2.7 | Yes |
| Next.js route handlers | with Cache Components, prerendering stops on `request.headers` or `headers()`; the handler runs at request time | `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, lines 87 to 124 | Yes |
| Next.js headers on dynamic handlers | a non-ISR handler's response is sent "without caching", as the handler built it | `node_modules/next/dist/build/templates/app-route.js`, line 262 (next 16.4.0) | Yes (framework source) |
| Next.js dynamic pages | `private, no-cache, no-store, max-age=0, must-revalidate`; CDN caching "does not support on-demand revalidation" without a CDN purge | `node_modules/next/dist/docs/01-app/02-guides/cdn-caching.md`, lines 24 and 26 | Yes |
| `'use cache'` limits | "cannot access runtime APIs like `cookies()`, `headers()`"; on serverless "Cache entries typically don't persist across requests" | `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`, lines 241 and 251 | Yes |
| `'use cache: remote'` | "Shared across all users" and all instances; "Remote cache entries do not persist across deploys" | `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache-remote.md`, lines 82 to 94 | Yes |
| Purge by tag | purges "CDN cache, Runtime Cache, and Data Cache"; Next.js 16 `revalidateTag(tag, 'max')` invalidates, `revalidateTag(tag)` and `updateTag(tag)` delete | https://vercel.com/docs/caching/cdn-cache/purge | Yes |
| Tag headers and limits | `Vercel-Cache-Tag` header or `addCacheTag()`; 128 tags per response, 256 bytes per tag; purge calls 50 a second per team on Hobby | same | Yes |
| `expire: 0` | "Stale content is never served"; for use "when the caller needs the data gone immediately and you cannot use `updateTag`" | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md`, lines 25 and 26 | Yes |
| Runtime Cache price, fra1 | $0.52 per million read units, $5.20 per million write units | https://vercel.com/docs/pricing/regional-pricing/fra1 (updated 14 September 2026) | Yes |

## 6. Rate limits and abuse on the Vercel Hobby plan

Hobby includes 1 million function invocations, 4 CPU-hours, 360 GB-hours of memory and 1 million CDN requests a month. Invocations count whether the request succeeds or fails, so a 401 costs the same as a page. Past a limit the owner waits until 30 days have passed, and a paused deployment answers `503 DEPLOYMENT_PAUSED` to every visitor. The dashboard and the API share that deployment. The earlier research already notes that Hobby is for non-commercial use only and Pro is the floor (`2026-10-13-seo-autopilot-vercel-nextjs.md`, line 73); the Hobby page fetched today says the same.

Legitimate polling alone can reach the cap. A site that polls one endpoint once a minute makes 43,200 calls in 30 days, so 24 such sites exceed 1 million. The webhook exists so sites do not need to poll.

WAF rate limiting is available on Hobby with one rule per project. It counts by IP or JA4 digest in a fixed window of 10 seconds to 10 minutes. Traffic it denies or limits does not count as CDN requests. Counting by an arbitrary header, such as the key, needs Enterprise. The `@vercel/firewall` SDK can count by any key from code, but the function has already been invoked by then. BotID does not fit: it validates a challenge that a browser solves, so a server calling the API cannot pass it.

As a rough guide, on Pro in Frankfurt 10 million bad-key requests would cost about $6 in invocations, $26 in CDN requests and about $2.60 of CPU. This assumes 5 ms of CPU per 401, and leaves out memory and the Pro usage credit.

Counting in Postgres turns every read into a write. Upstash's free tier allows 500,000 commands a month, which a limiter spends at one or more commands per request. The WAF rule is the only limit that stops a request before it costs an invocation.

`429` may carry `Retry-After`, and a cache must not store a 429. The IETF `RateLimit` and `RateLimit-Policy` header fields are still an Internet-Draft.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Hobby included usage | Function Invocations first 1,000,000; Active CPU 4 CPU-hrs; Provisioned Memory 360 GB-hrs; CDN Requests first 1,000,000; Fast Data Transfer first 100 GB; Fast Origin Transfer first 10 GB | https://vercel.com/docs/plans/hobby (updated 14 September 2026) | Yes |
| Over the limit on Hobby | "you will have to wait until 30 days have passed before you can use the feature again" | same | Yes |
| Hobby use | "non-commercial, personal use only" | same | Yes |
| Paused deployment | "`503 DEPLOYMENT_PAUSED` error means your production deployment is paused"; paused projects resume "never automatically" | https://vercel.com/kb/guide/why-is-my-account-deployment-blocked (updated 2 October 2026) | Yes |
| Invocation counting | "Counts each request to your function"; "Counts regardless of request success or failure"; Pro $0.60 per million | https://vercel.com/docs/functions/usage-and-pricing (updated 16 June 2026) | Yes |
| Pro prices, fra1 | Active CPU $0.184 an hour; memory $0.0152 per GB-hour; CDN Requests $2.60 per million; Firewall Rate Limit Requests $0.65 per million allowed requests | https://vercel.com/docs/pricing/regional-pricing/fra1 | Yes |
| WAF rate limiting on Hobby | "available on all plans"; 1 rule per project; keys IP and JA4 Digest; fixed window 10 s to 10 min; 1,000,000 allowed requests included; arbitrary header keys on Enterprise only | https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting (updated 28 August 2026) | Yes |
| Rate limit actions | default 429, or Log, Deny, Challenge; counters "tracked on a per-region basis" | same | Yes |
| Mitigated traffic | WAF deny, challenge or rate-limit mitigated traffic "does not incur CDN Requests or Fast Data Transfer" | https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing (updated 16 June 2026) | Yes |
| Hobby custom rules | up to 3 custom rules, up to 3 IP blocks | https://vercel.com/docs/plans/hobby | Yes |
| Rate Limiting SDK | `checkRateLimit()` from `@vercel/firewall` with a `rateLimitKey` such as a user id; needs a dashboard rule with the `@vercel/firewall` condition | https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk (updated 23 July 2026) | Yes |
| BotID | "a client-side challenge"; the browser solves it and the server calls `checkBotId()`; Basic free on all plans, Deep Analysis $1 per 1,000 calls on Pro | https://vercel.com/docs/botid (updated 16 June 2026) | Yes |
| Upstash Redis | free tier 500K commands a month, 250 MB; pay as you go $0.20 per 100K commands | https://upstash.com/pricing/redis | Yes |
| 429 | the response "MAY include a Retry-After header"; "Responses with the 429 status code MUST NOT be stored by a cache" | https://www.rfc-editor.org/rfc/rfc6585.html, section 4 | Yes |
| RateLimit headers draft | draft-ietf-httpapi-ratelimit-headers-11, 23 May 2026, active Internet-Draft, expires 24 November 2026; `RateLimit-Policy: "default";q=100;w=10`, `RateLimit: "default";r=50;t=30` | https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/ | Yes |
| Vercel on throttling | earlier research quotes Vercel: return 429 with `Retry-After` | `docs/research/2026-10-19-ai-access.md`, line 245 | No (earlier research) |

## 7. The database path from the API route

The repo reaches Supabase without a session through `createAdminClient()`, which uses `SUPABASE_SECRET_KEY`. That key acts as `service_role` and bypasses row level security. The Workflow steps use it. Every table policy is written `to authenticated` and checks `is_project_owner()`, so the `anon` role reads nothing directly. The repo's `security definer` functions set `search_path = ''`, revoke execute from `public` and `anon`, and grant it by name.

`proxy.ts` matches every path except static files and `.well-known/workflow/`. For `/api/v1/pages` it runs `updateSession()`: `getClaims()` finds no session, `/api/v1` is not a public path, and the request is redirected to `/login`. The API would not work. It should not run the session refresh at all: a customer's server has no cookies, Vercel runs the proxy before the cache, and it bills the proxy as compute. Excluding `api/v1` in the matcher is the fix.

There are three ways to keep the route at least privilege:

- the secret-key client: the smallest change, but any query that forgets `project_id` or `status = 'published'` returns another project's pages or drafts, and nothing in the database stops it
- SQL functions that take the key or its hash and return only published rows of that key's project: the two rules live in SQL, beside the repo's other functions; granted to `anon`, the route needs no secret key at all, but the functions can also be called at Supabase's own address by anyone who holds a valid site key, past our rate limits
- a dedicated Postgres role with `select` grants and its own policies: the database enforces everything, but the route needs a direct connection through Supavisor's transaction pooler, a database password as a new secret and a Postgres driver; through the Data API it would need JWTs signed with a key we import

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Admin client | `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })`, `server-only` | `lib/supabase/admin.ts` | Yes (repo) |
| Admin client rule | "A write with no user session (a Workflow step)" uses `createAdminClient()`, "never in a route a user calls" | `.claude/rules/orthogonality.md`, table row | Yes (repo) |
| Policies | `projects` and `pages` policies are `to authenticated`, through `is_project_owner()` | `supabase/migrations/20261015201700_projects.sql`; `20261016120000_crawl.sql`, lines 1 to 14; `20261016210000_write_page.sql`, lines 40 to 47 | Yes (repo) |
| Function pattern | `security definer`, `set search_path = ''`, `revoke execute ... from public, anon`, `grant execute ... to authenticated` | `supabase/migrations/20261017120000_audit.sql`, lines 208 to 244 | Yes (repo) |
| Proxy matcher | `'/((?!_next/static|_next/image|favicon.ico|.well-known/workflow/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'` | `proxy.ts`, line 11 | Yes (repo) |
| Proxy redirect | without claims and outside `/`, `/bot`, `/login` and `/auth/`, the request goes to `/login` | `lib/supabase/proxy.ts`, lines 41 to 52 and 63 to 68 | Yes (repo) |
| Proxy order | proxy runs before filesystem routes; a matcher change "can silently remove Proxy coverage" | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, lines 238 to 251 | Yes |
| Vercel middleware | "Because it runs globally before the cache"; priced on the fluid compute model; without a matcher it runs on every request | https://vercel.com/docs/routing-middleware (updated 14 August 2026) | Yes |
| Security definer | "It runs with its creator's privileges"; "you must set the `search_path`"; "Prefer `security invoker`, which is also the default" | https://supabase.com/docs/guides/database/functions | Yes |
| Default execute | "Any role can call it by default, including `anon`"; advice to revoke by default and grant per function | same | Yes |
| Built-in roles | `anon` for requests with no session, `authenticated` for signed-in users, `service_role` bypasses row level security | https://supabase.com/docs/guides/database/postgres/roles | Yes |
| Custom role connection | through the shared pooler "the username is `[ROLE].[PROJECT-REF]`"; transaction mode on port 6543 for serverless; no prepared statements | https://supabase.com/docs/guides/database/connecting-to-postgres | Yes |
| Minting JWTs | possible only "by importing a private key or setting a shared secret yourself"; the `role` claim must name an existing Postgres role | https://supabase.com/docs/guides/auth/signing-keys | Yes |

## Design implications for Citequill

### Where the project comes from

The facts touch the URL, which is hard to change once customers use it.

| Option | Trade-off |
| --- | --- |
| Project from the key only, as today | short URLs; no URL-level tenant for any cache, log or rate limit; a cached response at one URL is every project's response (section 5) |
| Site id in the path, key in `Authorization: Bearer` | the customer copies two values, but the snippet already holds `site_id`; every cache key and log line names the tenant; a valid key on another site's path is refused |

Recommendation: put the site id in the path, as in `GET /api/v1/sites/{siteId}/pages`, and reuse `projects.site_id`, which `docs/data-model.md` line 19 already calls public. Answer a valid key on another site's path with 403, because the site id is not secret and a clear error helps the person integrating. RFC 9110 allows 404 to hide the resource instead (section 4). This changes the endpoint table in `docs/content-api.md`, lines 11 to 16, and the base URL on line 3.

### Cache headers

| Option | Vercel caches | Risk between projects | Key checked on every read | Cost of a read |
| --- | --- | --- | --- | --- |
| A. Today: key in `Authorization`, `public, s-maxage=60, stale-while-revalidate=600` | no | through any downstream shared cache, and through any later change that lets Vercel store | yes | one invocation |
| B. Key in `Authorization`, `Cache-Control: private, no-cache`, `ETag` | no | none | yes | one invocation; `'use cache: remote'` by project id spares the database |
| C. Site id in the path, no key for published pages | yes | none, the URL separates projects | no | a CDN request on a hit |
| D. Site id in the path, key in a custom header, `Vary` on it, `Vercel-CDN-Cache-Control: s-maxage=60`, `Cache-Control: private, no-cache` | yes, one entry per URL and key, if `Vary` holds | none if `Vary` holds | a wrong key misses and gets 401 | a CDN request on a hit; revoking a key needs a delete by tag |
| E. `no-store` | no | none | yes | one invocation |

Recommendation: B now, with the site id in the path. It is the smallest safe change and needs no spike. It drops a claim, CDN offload, that is false for this header (section 5). Tag the remote cache by project and delete the tag when a page is unpublished or a key is deleted. Write the change in `docs/content-api.md` line 18, which today promises `public, s-maxage=60, stale-while-revalidate=600`.

Keep D as the step for when volume grows. It keeps the key as the gate and gets the CDN, but only if a spike on a preview deployment shows that Vercel keeps one entry per key value. Moving from B to D adds a header; it does not change the URL. C contradicts the owner's rule that nobody else may call a project's API, so it needs his decision before it is considered.

### Purging on publish, unpublish and key deletion

Publishing can use `revalidateTag(tag, 'max')`. Unpublishing and deleting a key must use `updateTag` in the dashboard's Server Action and `revalidateTag(tag, { expire: 0 })` in a Workflow step. Otherwise the done criterion of MVP step 5, that unpublishing removes the page from the list, fails for one stale response. This adds a step to "Publishing" in `docs/workflow.md`, lines 66 to 73.

### Keys as rows

Replace `site_key_hash` on `projects` (`docs/data-model.md`, line 12) with a `site_keys` table: `id`, `project_id`, `name`, `key_hash` (SHA-256 hex, unique), `key_hint` (the prefix and at most 6 characters), `created_at`, `last_used_on` (a date written at most once a day, so a read does not write every time, as DatoCMS shows only `today` or `this_week`). Deleting a row revokes the key. Rotation with overlap is two keys for a while, which matches Supabase's four steps and makes Stripe's 7-day grace period unnecessary. Show the key once, as Stripe, Sanity and Strapi do. Line 19 of `docs/data-model.md` and the Settings row of `docs/product.md`, line 67, change to "Content API keys", plural.

### Key format

Use a prefix of our own, such as `cq_sk_`, then 32 bytes from `randomBytes`, about 43 Base62 characters and 256 bits. A CRC32 checksum in the last 6 characters is optional. It lets the route refuse a typo or a forged key without a database call, as GitHub does, and it qualifies the format for GitHub's partner programme later. Store SHA-256 and look the key up by its hash. A slow hash adds CPU to every request and no protection at this entropy (section 3). Use `timingSafeEqual` only where code compares two digests itself. An exact match on a hash inside the database leaves an attacker no bytes to steer; that is our reasoning, not a sourced fact.

### Status codes and headers

- missing header: 401 with `WWW-Authenticate: Bearer realm="citequill"` and no error code
- unknown or deleted key: 401 with `error="invalid_token"`
- malformed request: 400
- valid key on another site's path: 403
- too many requests: 429 with `Retry-After`; the `RateLimit` fields are optional and only a draft
- no CORS headers in `v1`; no key in a query string ever

These replace "Without the header or with a wrong key: 401" in `docs/content-api.md`, line 7.

### Rate limits and the plan

The WAF rate-limit rule on `/api/v1`, by IP, with the default 429, is the only limit that stops a request before it costs an invocation. On Hobby it is the one rule available. Per-key limits through the `@vercel/firewall` SDK come after the invocation, so they protect the database, not the invocation cap. Do not count in Postgres. The webhook should be the documented way to learn of changes, with polling no more often than every few minutes. Hobby's 1 million invocations is the binding limit, and Hobby forbids commercial use. Opening the API to customers needs Pro, as the earlier research found.

### The database path

Recommendation: SQL functions own the two rules, a key's project and `status = 'published'`. The route calls them through one module in `features/`, never with a hand-built table query. Grant execute to `service_role` only, so the internet cannot reach them through Supabase's own address, and call them with the admin client. Granting them to `anon` instead would let the route run with no secret key at all. That is stricter but opens a second door that bypasses our rate limits. A dedicated Postgres role is the strongest guard, but it adds a database password, a driver and pooler limits, so it is not worth it for the MVP.

Either way the row in `.claude/rules/orthogonality.md` that keeps the admin client out of "a route a user calls" needs rewording, because the Content API is a route that customers' servers call. Resolve the key outside any `'use cache'` scope and pass only the project id in.

### The proxy

Add `api/v1` to the negative lookahead in `proxy.ts` line 11, so the session refresh never runs for the API. Say in `docs/content-api.md` that the API runs with no session and no cookies.

## Could not confirm

- Contentful's authentication page and its Content Delivery API reference answered 429 on all three attempts. Whether Contentful calls the Delivery token browser-safe, and whether it is shown once, is unconfirmed.
- Whether Vercel stores a response to a request with `Authorization` despite the documented condition. Our live check shows only that such a request can read an existing entry. A test on our own preview deployment is needed.
- Whether Vercel keeps one entry per value of `Vary` on a custom key header, which option D relies on. The docs describe `Vary` generally, and no page tests a secret header.
- What Vercel does with a stale entry when its background revalidation gets a 401.
- What happens on Hobby after the 1,000,000 allowed requests included for WAF rate limiting.
- Whether the `@vercel/firewall` rule condition works on Hobby; the SDK page names no plan.
- Whether Hobby includes any Runtime Cache usage for `'use cache: remote'`; the Hobby page lists none.
- Whether Supabase revokes a `sb_secret_` key that GitHub reports. GitHub lists it as a partner pattern; the Supabase page does not mention scanning.
- Whether Supabase logs the arguments of an RPC call, which matters if a raw key is passed to a function.
- NIST states the rule for secrets under 112 bits; the rule for 112 bits and above follows by implication. No OWASP page we fetched speaks to hashing API keys by name.
- GitHub's fine-grained token page does not say whether a token is shown once or whether last use is shown.
- The number of keys allowed per project for Ghost, Contentful, Strapi, Prismic and Hygraph.
- The status code of `NextResponse.redirect()` in the proxy; the docs read do not state it.
- The page on nodejs.org was cut off before `timingSafeEqual`; the quote comes from the copy in `@types/node` 20.19.43.

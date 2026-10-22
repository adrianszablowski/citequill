# The publishing webhook and IndexNow: facts for step 5, fetched 21 October 2026

Every fact below comes from a page fetched on 21 October 2026, or from a file in this repo read on that day. "Primary" means the specification, the vendor or the search engine wrote it. "Secondary" means a third party did. Most entries paraphrase their source closely; short quotations appear only where the owner's question turns on the exact words. Facts already in [`2026-10-13-seo-autopilot-gsc-indexnow.md`](2026-10-13-seo-autopilot-gsc-indexnow.md) section 2 are cited, not repeated.

## Summary

1. IndexNow is not unlimited. No primary source says it is. indexnow.org says limits exist, are set by each engine per site and are not published, and that a `429` means the site exceeded its rate. Yandex says there is no limit on the number of requests, but throttles by IP address and asks for 10 minutes between submissions of the same URL. The one source that claims no known daily limit is Rank Math, a plugin vendor, which adds that you should not exploit it. Every engine says to submit only URLs that were added, changed or deleted (section 6).
2. The design never pings IndexNow on unpublishing. indexnow.org says to submit deleted URLs that answer `404` or `410` and redirected URLs. Bing's guidelines say the same (section 6).
3. The key file must sit on the exact host of the submitted URLs, and every subdomain is a separate host. `content-api.md` checks `https://<domain>/<key>.txt`, and the domain is stored without `www.`, so the check fails for a site that answers on `www`. Citequill must check each locale's base URL origin (section 7).
4. The webhook signature has no replay protection, no event id and no way to rotate a secret without downtime. The Standard Webhooks specification covers all three with `webhook-id`, `webhook-timestamp` and a list of signatures. OpenAI, Anthropic, Twilio, Svix and others use it (section 1).
5. Three retries is far below common practice. Stripe retries for up to 3 days, Standard Webhooks suggests a schedule of about 3 days, and Svix disables an endpoint only after 5 days of failures. Every source treats a `3xx` as a failure and never follows it. Vercel Workflow can hold a 3-day schedule: `sleep()` costs no compute and has no maximum (section 2).
6. `fetchPublic()` is the right base for the webhook but does not fit as it is. It sends only GET and HEAD, follows redirects, allows `http` and checks DNS before the connection rather than at it, which OWASP names as the DNS rebinding gap (section 3).
7. A Vercel deploy hook, a Netlify build hook or a Cloudflare Pages deploy hook works pasted straight in as the webhook URL: a POST with no authentication. But Vercel allows 60 triggers an hour per project and Cloudflare starts a build for every request. One delivery per page means one build per page. Each of these URLs is a secret that lets anyone deploy the site (section 4).
8. Bing's guidelines ask for streaming submissions, not batches. Bing says to avoid batch submissions when possible and to notify it when a URL is added, updated or removed. Pinging at publishing time, as the design does, is right (section 6).
9. Wix, Duda, WordPress plugins and Cloudflare Crawler Hints already submit on their own. No source says a second submission of the same URL does harm. indexnow.org says to avoid duplicate submissions and that every submitted URL counts toward the site's crawl quota (section 8).
10. Citequill could submit the customer's other changed URLs when the key file is at the root, and the protocol has no rule against it. The engines limit IndexNow to real changes made after IndexNow was set up. A moved sitemap `lastmod` is not proof of a change (section 9).

## 1. Signatures and replay protection

Standard Webhooks signs the message id, the timestamp and the raw body together, so a captured request cannot be replayed later or under another id. Its signature header holds a list, so the sender can sign with an old and a new secret during rotation. Stripe does the same with its own header: a signed timestamp and one `v1` signature per active secret. GitHub and Shopify sign only the body and add a delivery id in a separate, unsigned header.

Citequill's current design, `Citequill-Signature: sha256=<HMAC of the body>`, is GitHub's scheme. It lacks three things: a timestamp inside the signed content, so a receiver cannot reject an old delivery; an event id, so a receiver cannot drop a duplicate; and a list of signatures, so the owner cannot rotate the secret without a moment where valid deliveries fail.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Standard Webhooks headers | `webhook-id`, `webhook-timestamp` (integer Unix seconds), `webhook-signature` | https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/spec/standard-webhooks.md | Yes |
| What is signed | `msg_id.timestamp.payload`, joined with full stops; the body must be byte-identical to what was signed | same | Yes |
| Signature schemes | `v1` is HMAC-SHA256, `v1a` is ed25519; value is the scheme, a comma, then base64, for example `v1,K5oZ…` | same | Yes |
| Secret format | random, 24 to 64 bytes, base64, prefixed `whsec_` | same | Yes |
| Rotation | the signature header is a space-delimited list, so the sender signs with the current and an old key for a period | same | Yes |
| Replay protection | the receiver checks the timestamp is within a tolerance; the spec gives no number | same | Yes |
| Idempotency | the receiver uses `webhook-id` as an idempotency key | same | Yes |
| Stripe header | `t=<timestamp>,v1=<signature>[,v1=…]`; signed content is `timestamp.body` | https://docs.stripe.com/webhooks | Yes |
| Stripe replay tolerance | libraries default to 5 minutes; a tolerance of 0 disables the check | same | Yes |
| Stripe retries | each retry gets a new timestamp and signature | same | Yes |
| Stripe rotation | old secret can stay active for up to 24 hours; one signature per active secret | same | Yes |
| GitHub header | `X-Hub-Signature-256: sha256=<hex HMAC>` of the payload; no timestamp | https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries | Yes |
| GitHub rotation | not documented; the page only says you can update the secret | same | Yes |
| GitHub delivery id | `X-GitHub-Delivery`, unique per event, the same on a redelivery | https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks | Yes |
| Shopify header | `X-Shopify-Hmac-SHA256`, base64 HMAC-SHA256 of the raw body; no timestamp | https://shopify.dev/docs/apps/build/webhooks/subscribe/https | Yes |
| Shopify duplicates | `X-Shopify-Webhook-Id` per delivery; `X-Shopify-Event-Id` shared by deliveries of one action | same | Yes |
| Constant-time comparison | GitHub, Stripe and Svix all require it | GitHub and Stripe pages above; https://docs.svix.com/receiving/verifying-payloads/how-manual | Yes |
| Svix secret | `whsec_` prefix, the rest base64-decoded is the HMAC key; signature list with `v1,` prefixes | https://docs.svix.com/receiving/verifying-payloads/how-manual | Yes |
| Implementations named by the initiative | OpenAI, Anthropic, Google Gemini, Model Context Protocol, Twilio, Svix, Kong, Clerk, Resend, ngrok, Render, PagerDuty, Etsy, Brex and others | https://www.standardwebhooks.com/ | Yes, the initiative's own list |
| Steering committee | members from Zapier, Twilio, Lob, Mux, ngrok, Supabase, Svix and Kong | same | Yes |
| Reference libraries | Python, JavaScript and TypeScript, Java and Kotlin, Rust, Go, Ruby, PHP, C#, Elixir | same | Yes |

## 2. Delivery, retries and the delivery log

Every source counts any `2xx` as success and everything else as failure, including timeouts and redirects. Schedules run for hours to days, not seconds. GitHub is the exception: it never retries on its own and offers a Redeliver button instead. Stripe, GitHub and Svix all show a delivery log with the status code and offer a manual resend.

Vercel Workflow can hold a long schedule in two ways. A step can throw `RetryableError` with `retryAfter` computed from the attempt number. Or the workflow can call `sleep()` between attempts, each attempt a step of its own; a sleep costs no compute while it waits.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Success and failure | any `2xx` succeeds; non-2xx, timeouts and connection resets fail | https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/spec/standard-webhooks.md | Yes |
| Redirects | `3xx` is a failure and is not followed; the consumer updates the URL | same | Yes |
| `410 Gone` | the sender disables the endpoint | same | Yes |
| `429`, `502`, `504` | throttle; respect `retry-after` when present | same | Yes |
| Timeout | 15 to 30 seconds | same | Yes |
| Example schedule | immediately, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 14 h, 20 h, 24 h, about 75 hours in all, with jitter | same | Yes |
| Long failure | notify the consumer by other channels and disable delivery | same | Yes |
| Payload size | no technical limit; keep under about 20 KB | same | Yes |
| Svix schedule | immediately, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h | https://docs.svix.com/retries | Yes |
| Svix timeout | 30 seconds | same | Yes |
| Svix disabling | after all attempts to an endpoint fail for 5 days | same | Yes |
| Svix manual tools | retry one message, recover all failed since a date, replay messages never attempted | same | Yes |
| Stripe live retries | up to 3 days with exponential backoff; sandbox 3 times over a few hours | https://docs.stripe.com/webhooks | Yes |
| Stripe `3xx` | treated as failure | same | Yes |
| Stripe delivery log | Event deliveries tab: Delivered, Pending or Failed, the HTTP status code and the next retry time | same | Yes |
| Stripe manual resend | Dashboard up to 15 days, CLI up to 30 days after the event | same | Yes |
| Stripe ordering | not guaranteed; track event ids to find duplicates | same | Yes |
| Stripe transport | public HTTPS required in live mode; TLS 1.2 or 1.3 | same | Yes |
| GitHub response limit | a `2XX` within 10 seconds | https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks | Yes |
| GitHub retries | none automatic; redeliver deliveries from the past 3 days | https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks | Yes |
| GitHub delivery log | past 3 days: request headers and payload, time sent, the response received | https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries | Yes |
| GitHub test event | `ping` is sent when a webhook is created, to confirm the setup | https://docs.github.com/en/webhooks/webhook-events-and-payloads | Yes |
| Shopify timeouts | 1 second to connect, 5 seconds for the whole request | https://shopify.dev/docs/apps/build/webhooks/subscribe/https | Yes |
| Shopify retries | 8 times over 4 hours; an Admin API subscription is deleted after 8 consecutive failures | same | Yes |
| Workflow default | a step retries up to 3 times, enqueued immediately after a failure | `node_modules/workflow/docs/foundations/errors-and-retries.mdx` (workflow 5.2.2) | Yes |
| Workflow custom delay | `RetryableError` with `retryAfter` as a duration string, milliseconds or a `Date` | `node_modules/workflow/docs/api-reference/workflow/retryable-error.mdx` | Yes |
| Workflow attempt number | `getStepMetadata().attempt`; `FatalError` stops retries | `node_modules/workflow/docs/foundations/errors-and-retries.mdx` | Yes |
| Workflow `sleep` | suspends for a duration or until a date without consuming resources | `node_modules/workflow/docs/api-reference/workflow/sleep.mdx` | Yes |
| Sleep mechanics on Vercel | continuation messages of at most 23 hours each, repeated until the target time | `node_modules/workflow/docs/worlds/vercel.mdx` | Yes |
| Maximum sleep and run duration | no limit | https://vercel.com/docs/workflows/pricing | Yes |
| Stable step id | `stepId` stays the same across retries; use it as an idempotency key | `node_modules/workflow/docs/foundations/idempotency.mdx` | Yes |
| Workflow billing | a step makes 3 events, plus one per retry; Hobby includes 50,000 events a month; 25,000 events per run | https://vercel.com/docs/workflows/pricing | Yes |

## 3. Outbound safety

The owner types the webhook URL, so a delivery is a request to an address a user chose. OWASP calls this case 2 of SSRF and names webhooks as the example. Its main points: allow only `http` and `https`, block private, loopback, link-local and metadata addresses, disable redirects, and enforce the address check at connection time, because a second DNS lookup between the check and the connection can bypass it.

The repo already has a guarded fetch, `fetchPublic()` in `features/crawl/fetch.ts`, and the orthogonality rules name it the one home for "a request to a site the owner named". What it does today:

- refuses any scheme other than `http` and `https`
- resolves the host and refuses it when any address is private; the block list covers every range in OWASP's minimum table, IPv4 and IPv6, and unwraps IPv4-mapped IPv6
- follows up to 10 redirects by hand, checking every hop again
- aborts after 15 seconds and reads at most 2 MB of the body
- sends only `GET` or `HEAD`

So it fits the webhook in its address policy and its timeout, which sits inside the 15 to 30 seconds Standard Webhooks advises. It does not fit in four ways. It cannot send a `POST` with a body. It follows redirects, which every webhook source treats as failures. It allows plain `http`, while Stripe requires HTTPS in live mode and Standard Webhooks advises it. Its address check runs on its own `dns.lookup` before `fetch`, and `fetch` resolves the name again when it connects, which is the gap OWASP describes. That last gap applies to the crawl and the audit as well.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Webhooks are SSRF case 2 | the user controls a URL to an external resource; allow lists cannot be used | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html | Yes |
| Schemes | check against an allowed list of `HTTP` or `HTTPS` | same | Yes |
| Redirects | disable redirect following in the web client | same | Yes |
| DNS rebinding | a second, unchecked lookup between validation and connection bypasses the check; connect to the validated IP, keep the hostname for `Host`, SNI and certificate checks; apply the policy to retries too | same | Yes |
| Minimum blocked ranges | `0.0.0.0/8`, RFC 1918, `127.0.0.0/8`, `169.254.169.254`, `224.0.0.0/4`, `::1/128`, `fc00::/7`, `fe80::/10`, `ff00::/8` | same | Yes |
| Timeouts and response size | not covered by the cheat sheet | same | Yes |
| Standard Webhooks advice | send through a filtering proxy that blocks internal IPs (it names smokescreen), from workers in a private subnet | https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/spec/standard-webhooks.md | Yes |
| `fetchPublic()` checks | scheme, every resolved address, every redirect hop, 15 s timeout, 2 MB cap, GET and HEAD only | `features/crawl/fetch.ts` lines 24 to 139 and 238 to 253 | Yes, the code |
| Connection-time check in undici | a custom `connect` built with `buildConnector` can inspect the socket and destroy it before use | `node_modules/.pnpm/undici@7.30.1/node_modules/undici/docs/docs/api/Connector.md` (a transitive dependency) | Yes |
| Vercel egress | deployments use dynamic IPs by default; shared static egress IPs cost $100 a month per project, Pro and Enterprise only | https://vercel.com/docs/connectivity/static-ips | Yes |

## 4. Deploy hooks and on-demand revalidation

All three build hooks take a plain POST with no authentication, so Citequill's signed POST triggers them as it is. The URL itself is the credential, so whoever holds it can rebuild the site. Each has a limit that one delivery per page would hit sooner than one delivery per publishing.

For a Next.js site, the other recipe is a Route Handler that verifies the signature and calls `revalidateTag`. Because the call comes from outside a Server Action, `updateTag` is not available; `revalidateTag(tag, { expire: 0 })` drops the data at once, and `revalidateTag(tag, 'max')` serves stale content while it refreshes.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Vercel method | POST in the introduction; the triggering section says GET or POST | https://vercel.com/docs/deploy-hooks | Yes |
| Vercel body and auth | no authentication and no payload needed | same | Yes |
| Vercel response | JSON `{ job: { id, state: "PENDING", createdAt } }`; status code not stated | same | Yes |
| Vercel limits | 5 hooks per project on Hobby and Pro; 60 triggers an hour per project across all its hooks | same | Yes |
| Vercel repeat requests | earlier deployments of the same version from the same hook are cancelled | same | Yes |
| Vercel secrecy | anyone with the URL can deploy; treat it like a token or password | same | Yes |
| Netlify method and body | POST; a body is passed to the build, URL-encoded, as `INCOMING_HOOK_BODY` | https://docs.netlify.com/configure-builds/build-hooks/ | Yes |
| Netlify parameters | `trigger_branch`, `trigger_title`, `clear_cache` | same | Yes |
| Netlify limits | the build hooks page states none; the API allows 3 deploys a minute and 100 a day | https://docs.netlify.com/api/get-started/ | Yes |
| Cloudflare Pages method and auth | POST, no additional authentication | https://developers.cloudflare.com/pages/configuration/deploy-hooks/ | Yes |
| Cloudflare Pages behaviour | every request starts a new build; protect the URL like a secret | same | Yes |
| Cloudflare Pages build limits | 500 builds a month on Free, 5,000 on Pro, 20,000 on Business; 1 concurrent build on Free | https://developers.cloudflare.com/pages/platform/limits/ | Yes |
| Next.js on-demand revalidation | `revalidateTag` works in Server Actions and Route Handlers; `updateTag` only in Server Actions | `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md` (Next.js 16.4.0) | Yes |
| Next.js from a webhook | pass `{ expire: 0 }` to expire the data immediately | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md` | Yes |
| Next.js advice for CMS content | tag it with `cacheTag`, give it a long `cacheLife` such as `max`, and let a webhook call `revalidateTag` | `09-revalidating.md` above | Yes |

## 5. Events and payload

Both Standard Webhooks and Stripe describe two shapes. A thin event carries the type, the id and the ids of what changed, and the receiver fetches the current state. A full event carries a snapshot that may be stale by the time it is processed. Stripe recommends thin events for new integrations. Standard Webhooks says the choice is not binary: a thin payload can carry the fields most receivers need.

Citequill's payload is already thin: page id, locale, slug, path and URL. It lacks an event id and a fixed envelope.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Standard Webhooks envelope | `type` (full-stop delimited, for example `user.created`), `timestamp` (ISO 8601, when the event occurred), `data` | https://raw.githubusercontent.com/standard-webhooks/standard-webhooks/main/spec/standard-webhooks.md | Yes |
| Thin and full payloads | full means fewer API calls; thin is lighter, easier to keep compatible and keeps data access auditable; a thin payload can include common fields | same | Yes |
| Event selection | consumers should choose event types, filtered by the producer | same | Yes |
| Stripe thin event fields | `id`, `type`, `created`, `related_object` with its id, type and API URL | https://docs.stripe.com/events/how-events-work | Yes |
| Stripe recommendation | thin events for new integrations; they are unversioned and the receiver fetches the latest state | same | Yes |
| Stripe snapshot risk | the snapshot can be stale; fetch the latest version before acting | same | Yes |
| Stripe advice | listen only to the event types you need | https://docs.stripe.com/webhooks | Yes |
| Event id for duplicates | Stripe tells receivers to log processed event ids; GitHub keeps the delivery id on redelivery | Stripe page above; https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks | Yes |

## 6. IndexNow limits and when to submit

I read indexnow.org's documentation and FAQ again today. On every point the 13 October file recorded, the pages say the same: limits are not disclosed and each engine sets its own threshold per site, the same URL waits 5 minutes in one answer and 10 in another, a POST holds 10,000 URLs, and the response codes are unchanged. The entries below were on the pages today but are not in that file. I cannot tell whether they are new on the pages.

The owner's question, whether any source says there is no limit, has this answer:

- indexnow.org's documentation says to submit changes "up to some limit" and to check "that you don't submit too often"
- indexnow.org's FAQ says it "does not publicly disclose exact rate limits", because each engine sets them per site, and that a `429` means "you have exceeded your site's submission rate limit"
- Yandex says "There is no limit on the number of requests", then that its algorithms "prevent sending too many requests", that a `429` means the requests from one IP address exceeded its limit, and that the same URL should wait 10 minutes
- Rank Math, a plugin vendor, says the feature "does not have any known limitation" per day, and in the next sentence advises not to exploit it

No primary source says IndexNow has no limits. Every source that speaks about volume says to submit only new, changed or deleted URLs.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| When to submit | automate submission as soon as content is added, updated or deleted, up to an unstated limit | https://www.indexnow.org/documentation | Yes |
| Disclosed rate limits | none; each participating engine sets its own daily threshold per site | https://www.indexnow.org/faq | Yes |
| Unchanged URLs | submit only when content has changed; do not resubmit unchanged URLs | same | Yes |
| Same URL many times a day | avoid it unless the content changed meaningfully; wait at least 5 minutes between updates | same | Yes |
| After a `429` | wait for `Retry-After`; reduce frequency and batch size; avoid duplicate submissions; wait at least 10 minutes before resubmitting the same URL unless it changed significantly | same | Yes |
| Meaningful changes | skip layout and cosmetic changes; submit content, price and availability changes | same | Yes |
| Crawl quota | every submitted URL counts toward the site's crawl quota | same | Yes |
| Deleted and redirected URLs | submit redirected URLs (301, 302, meta refresh) and pages answering `404` or `410` | same | Yes |
| Changes before setup | do not submit them; IndexNow is not for retroactive submission; use sitemaps with accurate `lastmod` | same | Yes |
| The whole site | acceptable only when the whole site changed, such as after a migration or redesign | same | Yes |
| Indexing | submission does not guarantee indexing; each engine applies its own quota, schedule and quality signals | same | Yes |
| Yandex requests | no limit on the number of requests, but algorithms prevent too many; `429` is per IP address | https://yandex.ru/support/webmaster/en/indexnow/reference | Yes |
| Yandex same URL | do not send it too often; when needed, at 10-minute intervals | same | Yes |
| Yandex scope | report only new, changed or deleted pages; indexing is not guaranteed | https://yandex.com/support/webmaster/en/indexing-options/index-now | Yes |
| Bing notification | use IndexNow when URLs are added, content is updated or URLs are removed | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a | Yes |
| Bing batching | "Avoid batch submissions when possible"; streaming gives faster updates and less server load | same | Yes |
| Bing removal | return `404` for permanently removed content and update it through IndexNow | same | Yes |
| Bing abuse list | cloaking, link schemes, duplicates, scraping, keyword stuffing, unsupervised auto-generated content at scale, thin affiliates, malware, misleading markup, prompt injection; IndexNow over-submission is not on the list | same | Yes |
| Bing on large changes | when thousands to millions of URLs change, throttle the submission to avoid being throttled | https://www.bing.com/webmasters/help/url-submission-62f2860b (Content Submission API answer) | Yes |
| Bing URL Submission API | still supported, may be deprecated; Bing strongly recommends IndexNow | same | Yes |
| Rank Math claim | no known limit on URLs per day, but do not exploit it; it also misdescribes `429` as exceeding 10,000 per POST | https://rankmath.com/kb/instant-indexing/ | No, a plugin vendor |

## 7. Mechanics: the request, the responses and the key file

One POST to one endpoint reaches every participating engine. The body names the host, the key, the key file's location when it is not at the root, and up to 10,000 URLs. The key file is a UTF-8 text file holding the key.

The key file's place limits what it can prove. A file at the root of a host covers every URL on that host. A file under `/catalog/` covers only URLs under `/catalog/`. A different subdomain is a different host with its own key file. So `www.example.com` and `example.com` need a file each, and the file must sit on the host the URLs use. A host may hold several key files, so Citequill's key can sit beside a key a plugin already serves.

`keyLocation` may point to any public path on the same host. A path that the customer's server proxies to Citequill qualifies, because the answer comes from the customer's host. The proxied path must be the root file, `/<key>.txt`, or the scope rule leaves Citequill's pages uncovered. No source says whether engines follow a redirect when they fetch the key file.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Endpoints | submit to only one participating endpoint; the submission is shared with all others | https://www.indexnow.org/faq | Yes |
| Shared endpoint | `https://api.indexnow.org/indexnow`; Bing's own guide uses `Host: api.indexnow.org` | https://www.indexnow.org/faq; https://www.bing.com/indexnow/getstarted | Yes |
| Engine endpoints | `https://www.bing.com/indexnow`, `https://yandex.com/indexnow` | https://www.bing.com/indexnow/meta.json; https://yandex.ru/support/webmaster/en/indexnow/reference | Yes |
| Registry | bing, yandex, seznam, naver, yep, internetarchive, amazonbot, unchanged since 13 October | https://www.indexnow.org/searchengines.json | Yes |
| POST | `POST /indexnow`, `Content-Type: application/json; charset=utf-8`, body `{ host, key, keyLocation?, urlList }` | https://www.indexnow.org/documentation | Yes |
| `200` | URL submitted successfully | same | Yes |
| `202` | received, key validation pending; expected on the first request, then `200` once verified | same; https://www.indexnow.org/faq | Yes |
| `400` | invalid format | https://www.indexnow.org/documentation | Yes |
| `403` | key not valid: file not found, or found without the key | same | Yes |
| `422` | URLs not on the host, or the key does not match the schema | same | Yes |
| `429` | too many requests, potential spam | same | Yes |
| `405` at Yandex | only GET and POST are allowed | https://yandex.ru/support/webmaster/en/indexnow/reference | Yes |
| Several key files | one to many key files may sit elsewhere on the same host, named with `keyLocation` | https://www.indexnow.org/documentation | Yes |
| Key file scope | a file under `/catalog/` covers only URLs under `/catalog/`; others may not be considered | same | Yes |
| Subdomains | each is a separate host with its own key file and key | https://www.indexnow.org/faq | Yes |
| Rotation | replace the file and submit with the new key; engines verify it on the next submission | same | Yes |
| Key secrecy | only you and the search engines should know the key and its location | https://www.indexnow.org/documentation | Yes |
| Static file | Next.js serves files in `public/` from the base URL `/`, with `Cache-Control: public, max-age=0` | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/public-folder.md` | Yes |
| Proxy from the customer's host | Next.js rewrites act as a URL proxy and can point to an external URL | `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md` | Yes |
| Cloudflare | a Worker route maps a URL pattern to a Worker; the domain must be proxied by Cloudflare | https://developers.cloudflare.com/workers/configuration/routing/routes/ | Yes |
| WordPress | the Bing Webmaster team's plugin generates and hosts its own key; 100,000+ active installations | https://wordpress.org/plugins/indexnow/ | Yes |
| Shopify root files | a store cannot upload files to the root; a URL redirect from `/<key>.txt` to an uploaded file is the workaround | https://cleancommit.io/blog/indexnow-for-shopify/ | No, a tool vendor |
| Shopify redirects | redirect only from a URL that is broken; up to 100,000 redirects | https://help.shopify.com/en/manual/online-store/menus-and-links/url-redirect | Yes |
| Shopify app proxy | only under `/a`, `/apps`, `/community` or `/tools`; the merchant may change the subpath | https://shopify.dev/docs/apps/build/online-store/app-proxies | Yes |

## 8. How large integrators do it

Most large platforms submit on their own and need nothing from the site owner. They detect changes in their own content: a WordPress plugin reacts to a post being saved, Duda to a page being published, Cloudflare to a cache miss. Bing's dashboard shows where each submission came from.

No source says a second submission of the same URL does harm. indexnow.org asks senders to avoid duplicate submissions and counts every URL toward the crawl quota. Bing's abuse list does not mention IndexNow.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Cloudflare Crawler Hints | tells engines through IndexNow when content has likely changed, judged by a cache `MISS` | https://developers.cloudflare.com/cache/advanced-configuration/crawler-hints/ | Yes |
| Crawler Hints plans and scope | Free, Pro, Business and Enterprise; one switch for the whole site | same | Yes |
| Crawler Hints error codes | responses with a status above 4xx are not reported | same | Yes |
| Yoast | pings an IndexNow endpoint when a post, page or URL is created or updated | https://developer.yoast.com/features/integrations/indexnow | Yes |
| Rank Math | free; pings when a post is created, updated or deleted; skips URLs set to noindex | https://rankmath.com/kb/instant-indexing/ | Yes, for its own plugin |
| Bing's WordPress plugin | detects page creation, update and deletion and submits in the background | https://wordpress.org/plugins/indexnow/ | Yes |
| Wix | Premium plans only; checks for page changes and submits them; no setup | https://support.wix.com/en/article/how-wix-uses-indexnow-to-inform-search-engines-about-your-site-changes | Yes |
| Duda | since 11 November 2021, submits only pages with updated content, with a token per site, no setup | https://www.duda.co/product-updates/indexnow | Yes |
| Shopify | the IndexNow FAQ lists Shopify among CMSs supported natively or through plugins; no Shopify page found; App Store apps sell it | https://www.indexnow.org/faq; https://apps.shopify.com/instaindex | Yes for the FAQ, no Shopify statement |
| Platforms on Bing's page | Yoast, Wix, Duda, Rank Math, AIOSEO, SEOPress, Cloudflare | https://www.bing.com/indexnow | Yes |
| Platform submissions need no key | when a CMS, host or SEO plugin supports IndexNow, submissions happen automatically | https://www.indexnow.org/faq | Yes |
| Bing IndexNow Insights | shows the source of submissions (Cloudflare, WordPress, manual) and whether a URL was submitted late | https://blogs.bing.com/webmaster/March-2024/Optimize-your-Impact-with-IndexNow-Insights | Yes |
| Duplicate submissions | avoid unnecessary or duplicate submissions | https://www.indexnow.org/faq | Yes |

## 9. Submitting the customer's other changed URLs

The protocol accepts any URL inside the key file's scope, and it proves nothing beyond control of the host. With the key file at the root, Citequill could submit any URL on that host. No source speaks about a third party submitting a site's other URLs.

What the sources do say narrows which URLs qualify. Only new, changed or deleted URLs. Only changes made after IndexNow was set up. Only meaningful changes, not layout or cosmetic edits. Google, in the 13 October file section 3.1, trusts `lastmod` only when it is consistently and verifiably accurate, and Bing asks for accurate `lastmod` values. A moved `lastmod` on its own is therefore weak evidence. A changed `body_hash` between two audits is a measured change of the main text, but an audit runs on demand, so the change may be days old when Citequill sees it.

Two further constraints come from earlier sections. The customer's platform may already submit those URLs, so Citequill would duplicate. And the key file's place decides the reach: a key under a subpath covers only that subpath.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Ownership proof | only the key file on the host | https://www.indexnow.org/documentation | Yes |
| Which URLs | new, changed or deleted | https://yandex.com/support/webmaster/en/indexing-options/index-now; https://www.indexnow.org/faq | Yes |
| Older changes | not retroactive; use sitemaps with accurate `lastmod` | https://www.indexnow.org/faq | Yes |
| Change size | meaningful content changes only | same | Yes |
| `lastmod` | Bing asks for accurate `lastmod` and ETags to detect changes | https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a | Yes |
| Third-party submission of other URLs | not addressed by any source found | searches of indexnow.org, Bing and Yandex pages above | not applicable |

## Design implications for Citequill

### Webhook signature

Options:

- keep `Citequill-Signature: sha256=<HMAC>`: one line for the receiver, but no replay protection, no event id, no rotation (section 1)
- Stripe's style, one custom header with `t=` and `v1=`: covers all three, but receivers need Citequill-specific code
- Standard Webhooks: covers all three, and receivers can use a published library in 9 languages (section 1)

Recommendation: Standard Webhooks, with `v1` HMAC-SHA256 and a `whsec_` secret of 32 random bytes. During a rotation keep the old secret for up to 24 hours, as Stripe does, and sign with both. Changes: `docs/content-api.md` line 64; `docs/data-model.md` line 12, where `webhook_secret` gains a previous secret and its expiry.

### Retry schedule

Options:

- the current 3 retries: under a minute of tolerance for a site that is down
- the Standard Webhooks example schedule over about 3 days, with jitter (section 2)
- Shopify's 8 retries over 4 hours: short, and Shopify deletes the subscription afterwards

Recommendation: the Standard Webhooks schedule. A `3xx` fails and is never followed; a `410` disables the webhook; a `429`, `502` or `504` waits for `Retry-After` when sent. After 5 days of failures, as Svix does, Settings shows the webhook as disabled. Build it as one Workflow run per delivery: a step per attempt with `maxRetries = 0`, and `sleep()` between attempts, so each attempt is its own row in the log. About 5 events an attempt makes 50 for a fully failed delivery, small against Hobby's 50,000 a month. Changes: `docs/content-api.md` line 64; `docs/workflow.md` lines 70 and 73.

### Delivery log, redeliver and test event

Every vendor in section 2 shows deliveries with their status code and offers a resend; GitHub sends a `ping` when a webhook is created. Recommendation: a `webhook_deliveries` table with the event id, type, payload, attempt, status code, the first 1 KB of the response, the next attempt and when it was delivered. Settings shows recent deliveries, a Redeliver button that keeps the event id, and Send test event. Changes: a new row in `docs/data-model.md`; the Settings row in `docs/product.md` line 67.

### Outbound safety

Options:

- call `fetchPublic()` as it is: wrong method, follows redirects, allows `http` (section 3)
- a second guarded client for webhooks: two copies of the address policy, against `.claude/rules/orthogonality.md`
- extend `fetchPublic()` with a POST body and a no-redirect mode, and move the address check to connection time

Recommendation: the third option. Webhook URLs must be `https` and public at save time and at every delivery. The connection-time check also closes the DNS rebinding gap for the crawl and the audit (section 3). Keep the 15-second timeout and read only what the log stores. Treat the webhook URL as a secret, because a deploy hook URL lets anyone deploy (section 4): mask it in Settings after saving and keep it out of logs. Changes: the Webhook section of `docs/content-api.md` lines 48 to 64; the `fetchPublic()` row in `.claude/rules/orthogonality.md`, when the code changes.

### One delivery per publishing, and the recipes

Options:

- one delivery per page event: precise for a revalidating receiver, but one build per page for a deploy hook, against Vercel's 60 an hour and Cloudflare's 500 builds a month (section 4)
- one delivery per publishing action of a translation group, with the list of its pages: one build per group, and a revalidating receiver loops over the list
- a debounce window per project: fewer builds still, but a delay and more state

Recommendation: one delivery per publishing action, because the publishing function in `docs/workflow.md` already works per translation group. Add a recipes part to `docs/content-api.md`: paste a Vercel, Netlify or Cloudflare Pages hook as it is, or verify the signature in a Route Handler and call `revalidateTag(tag, { expire: 0 })`. Changes: `docs/content-api.md` lines 50 and 64; `docs/decisions.md` line 78.

### Payload

Recommendation: the Standard Webhooks envelope, `{ "type", "timestamp", "data" }`, with the event id in `webhook-id`. Types `page.published`, `page.updated`, `page.unpublished` and `webhook.test`. `data.pages` lists `{ id, locale, slug, path, url }`, and an unpublished page adds its status, 301 or 410, and the redirect target. Keep it thin, because the receiver reads the page from the API, which Stripe recommends (section 5). Changes: `docs/content-api.md` lines 52 to 64.

### IndexNow volume

The owner's belief does not hold (section 6). Recommendation:

- submit on publishing, on an update only when the rendered body changed, and on unpublishing, with the old URL
- never submit the same URL twice within 10 minutes, the stricter of the two figures
- never submit the back catalogue, unless the owner says the whole site was migrated
- read each response: `200` and `202` succeed; `403` clears `indexnow_verified_at` and Settings shows that the key file failed; `422` is logged as a bug; `429` waits for `Retry-After` or 10 minutes through `RetryableError`
- submit through `api.indexnow.org`, one endpoint, at publishing time, never as a weekly batch, which Bing's guidelines ask for

Changes: `docs/content-api.md` line 68; `docs/workflow.md` line 71, and line 73, which gains the ping on unpublishing; a decision in `docs/decisions.md` that IndexNow submits only changed URLs, replacing the owner's assumption.

### Key file location

Options:

- a static file `/<key>.txt` at the root of every distinct origin among the project's locale base URLs: works on any host with root upload, never changes unless the key does
- the customer proxies `/<key>.txt` to Citequill, by a Next.js rewrite or a Cloudflare Worker route: Citequill can rotate the key alone, but the check depends on Citequill being up
- a `keyLocation` under a subpath: covers only that subpath, so it fails for pages outside it

Recommendation: the static file by default, the proxy as a documented alternative. Check the file on each locale's origin, with `www` or without as the base URL says, not on `projects.domain`. On Shopify, say IndexNow is unavailable until a test shows the redirect workaround verifies, because no source confirms it. Changes: `docs/content-api.md` line 68, where `https://<domain>/<key>.txt` becomes the base URL's origin; `docs/product.md` line 44.

### Platforms that already submit

A page Citequill publishes reaches the site through the API and a template, not as a WordPress post or a Duda page. So the platform's own trigger may never fire for it. That is my inference, not a source's statement. Recommendation: keep Citequill's ping on by default, deduplicated as above. Let the owner turn it off in Settings when the platform already covers these pages, and name in Settings the platforms that submit on their own (section 8). Changes: `docs/product.md` line 44.

### Other changed URLs

Recommendation: leave it out of step 5 and put it in the backlog in `docs/decisions.md`. If it comes later, make it opt-in. Use it only with the key at the root, and only for URLs whose `body_hash` changed between two audits, never for a moved `lastmod` alone. Deduplicate it with Citequill's own submissions. Settings should say it duplicates any platform that already submits (section 9). The key file already proves control of the host, so it could serve the domain verification in the backlog at `docs/decisions.md` line 889.

### Shared IP addresses

Yandex counts `429` per IP address, and Vercel functions send from dynamic IPs by default (sections 3 and 6). Every customer's submissions may leave from addresses that other Vercel customers share. Recommendation: count `429` answers per project and across projects in the run log, and reconsider static IPs, Pro only at $100 a month per project, if they rise.

## Could not confirm

- Whether indexnow.org's documentation or FAQ changed between 13 and 21 October 2026. Every fact the 13 October file recorded matches today.
- Whether IndexNow engines follow a redirect when they fetch the key file. This decides whether the Shopify workaround works.
- How `api.indexnow.org` counts its limits, by site, key or IP address, and who operates it.
- Whether Yoast's IndexNow needs Premium. Only search snippets of a changelog said so; the developer page I fetched does not.
- When Stripe disables a failing endpoint. Only forum posts quoting Stripe emails describe it.
- Whether Netlify's API limit of 3 deploys a minute and 100 a day applies to build hooks.
- The status code each deploy hook returns, and whether Vercel's hook accepts a JSON body with extra headers. Its docs say only that no payload is needed.
- Whether Shopify supports IndexNow natively. The IndexNow FAQ lists Shopify; no Shopify page says so.
- Whether a duplicate submission from two sources lowers crawl priority. No source says so either way; the claims I found are on third-party sites.
- Svix's timestamp tolerance in minutes. Its manual verification page gives none.
- What Cloudflare's Crawler Hints page means by statuses above 4xx, and so whether it reports `404` and `410`.
- The Bing Webmaster Tools help page for IndexNow itself, if one exists. I read the guidelines, the URL submission page and the IndexNow pages on bing.com.

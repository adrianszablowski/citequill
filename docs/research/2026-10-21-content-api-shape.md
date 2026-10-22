# Content API shape: dates, errors, sync, caching, contract and platforms (fetched 21 October 2026)

Every fact below comes from a page fetched on 21 October 2026, with its URL. "Primary" means the standards body or the vendor wrote it. "Test" means a test run on 21 October 2026 on this machine, with PostgreSQL 18.6 and Node.js 22.12.0, whose output is quoted. Facts already in [`2026-10-13-seo-autopilot-gsc-indexnow.md`](2026-10-13-seo-autopilot-gsc-indexnow.md) and [`2026-10-19-structured-data.md`](2026-10-19-structured-data.md) are cited by section, not repeated. Vercel's CDN behaviour with authentication belongs to `2026-10-21-content-api-access.md`, deploy hooks and IndexNow to `2026-10-21-webhook-indexnow.md`, and the page image to `2026-10-21-company-data-html.md`.

## Summary

1. Several sites in the "for every site" test cannot make the GET the guide describes when a page renders. Shopify's Liquid has no tag that fetches a URL, and an app proxy needs an installed app. Squarespace documents no API for posts. Webflow, Wix and Framer render from their own CMS, which only a push fills. A GET-only guide serves sites that run server code or have a build step. Section 7.
2. Dates as Postgres and PostgREST write them would break clients. The fractional digits vary from none to 6, the offset is `+00:00`, a `+` in a query string decodes to a space, JavaScript keeps only milliseconds, and string order breaks. One serialiser should write every date as `YYYY-MM-DDTHH:mm:ss.sssZ`. Section 1.
3. `updatedAt` cannot be trusted as the code writes it today. The editor sets `updated_at` on every save, also on a published page whose HTML did not change. And Postgres `now()` is the start of the transaction, so a sync by `updatedSince` can miss a row that commits late. Sections 1 and 3.
4. A client that syncs with `updatedSince` never learns that a page was unpublished. `GET /redirects` has no page id and no date. Every sync API fetched has a deletion record: Contentful `DeletedEntry`, Contentstack `entry_unpublished`, Microsoft Graph `@removed`, Google Calendar's deleted entries. Section 3.
5. Google accepts a sitemap on another host when the site's robots.txt names it, with no Search Console verification. Citequill can serve a ready XML sitemap per project at a public URL, and a site adds it with one robots.txt line, Shopify included. JSON alone makes every customer get the XML, the escaping and the hreflang set right. Section 9.
6. `translations` and the locale codes miss Google's hreflang rules as designed. Each version must list itself, `x-default` is recommended, a region must be ISO 3166-1 alpha-2, and the crawl stores codes in lowercase. Open Graph wants a third form, `pl_PL`. Sections 1 and 8.
7. Errors have no shape yet. RFC 9457 `application/problem+json` is the standard, and a 401 must carry `WWW-Authenticate`. Section 2.
8. The limit of 200 full pages per list can pass Vercel's 4.5 MB response cap. Stripe, GitHub, Ghost and WordPress cap lists at 100. Section 3.
9. `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` sets freshness for shared caches only. A customer's own cache gets no explicit lifetime. Section 4.
10. Structured data must match what the page shows. The template must show the byline and both dates, and breadcrumbs for the `BreadcrumbList`, which the API does not give the site. Section 8.

## 1. Dates and locale codes

RFC 3339 is the internet profile of ISO 8601. It allows a lowercase `t` and `z` but tells generators to use uppercase. Fractional seconds are optional and called rarely used. JavaScript parses one format for certain, `YYYY-MM-DDTHH:mm:ss.sssZ` with exactly 3 fractional digits. Any other string is up to the engine, and a date-time with no offset is read as local time.

Postgres writes `timestamptz` to JSON in ISO 8601 since version 9.4. The test below shows what that means: the fractional part has as many digits as the value needs, from none to 6, and the offset is `+00:00`. PostgREST returns the time in the server's time zone, and Supabase sets UTC by default. So a Supabase row reaches a client as `2026-10-15T06:12:00.123456+00:00`. In JavaScript that value loses its last 3 digits, a `+` in a query string turns into a space, and two values with different precision sort wrongly as strings.

Vendors differ. Stripe sends Unix seconds. GitHub, Ghost and Strapi send ISO 8601 in UTC; Ghost's examples write 3 digits and `+00:00`, Strapi's 3 digits and `Z`. WordPress sends `date_gmt` with no offset at all, so JavaScript reads it as local time.

Each output of a page has its own date format. JSON-LD takes ISO 8601 and Google recommends a time zone ([structured data file, section 1](2026-10-19-structured-data.md#1-article)). A sitemap takes W3C Datetime, RSS takes RFC 822, Atom and JSON Feed take RFC 3339, HTTP takes IMF-fixdate. Google also wants a visible date that matches the structured one.

Two facts from this repo bear on `updatedAt`. `updatePage()` in `features/pages/actions.ts` line 109 writes `updated_at: new Date().toISOString()` on every save of the editor, and the column's default is `now()`. Postgres `now()` is the start time of the transaction, not the commit.

BCP 47 tags are case-insensitive, with conventional casing `pl`, `zh-Hant`, `en-US`. Google's hreflang accepts a narrower set: ISO 639-1 languages, optional ISO 3166-1 alpha-2 regions and ISO 15924 scripts, in any case. A UN M.49 region such as `es-419` is valid BCP 47 but outside Google's list. The crawl lowercases every hreflang value it stores (`hreflangAlternates()` in `features/crawl/html.ts`), so `project_locales.locale` can hold `en-us`. `Intl.getCanonicalLocales` turns that back into `en-US`.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| RFC 3339 `date-time` | `full-date "T" full-time`; `time-offset = "Z" / time-numoffset`; `time-secfrac = "." 1*DIGIT`, optional | https://www.rfc-editor.org/rfc/rfc3339 section 5.6 | Yes |
| Case of `T` and `Z` | may be lowercase; "Applications that generate this format SHOULD use upper case letters" | same, section 5.6 | Yes |
| Fractional seconds | a "rarely used" option, "expected" only where strict ordering is needed | same, section 5.3 | Yes |
| Unknown local offset | written `-00:00` | same, section 4.3 | Yes |
| JavaScript date string format | `YYYY-MM-DDTHH:mm:ss.sssZ`; "`sss` is the millisecond, with three digits" | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date | No, reference for ECMA-262 |
| JavaScript with no offset | "date-only forms are interpreted as a UTC time and date-time forms are interpreted as a local time" | same | No |
| JavaScript with another format | "support for other formats is not guaranteed" | same | No |
| Postgres JSON of `timestamptz` | "render the values in a format compliant with ISO 8601" since 9.4 | https://www.postgresql.org/docs/9.4/release-9-4.html | Yes |
| Postgres 18.6 output with UTC | `"2026-10-15T06:12:00+00:00"`, `"2026-10-15T06:12:00.5+00:00"`, `"2026-10-15T06:12:00.123456+00:00"` | Test: `to_json()` on three values | Test |
| PostgREST time zone | "The response has the date in the time zone configured by the server" | https://docs.postgrest.org/en/v14/how-tos/working-with-postgresql-data-types.html | Yes |
| Supabase default time zone | "Every Supabase database is set to UTC timezone by default." | https://supabase.com/docs/guides/database/postgres/configuration | Yes |
| JavaScript and 6 digits | `new Date("2026-10-15T06:12:00.123456+00:00").toISOString()` gives `2026-10-15T06:12:00.123Z` | Test, Node.js 22.12.0 | Test |
| String order with mixed precision | `"…06:12:00Z" < "…06:12:00.5Z"` is false, though the first is earlier | Test | Test |
| `+` in a query string | `?updatedSince=2026-10-15T06:12:00+00:00` reads as `"2026-10-15T06:12:00 00:00"`, then `Invalid Date` | Test with `URL.searchParams` | Test |
| Why `+` becomes a space | "Replace any 0x2B (+) in name and value with 0x20 (SP)." | https://url.spec.whatwg.org/ section 5.1 | Yes |
| Stripe dates | `created`: "Measured in seconds since the Unix epoch", example `1679090539` | https://docs.stripe.com/api/charges/object | Yes |
| GitHub dates | "Timestamps returned by the API are in UTC time, ISO 8601 format." | https://docs.github.com/en/rest/using-the-rest-api/timezones-and-the-rest-api | Yes |
| Ghost dates | `"published_at": "2019-11-26T02:44:17.000+00:00"` | https://docs.ghost.org/content-api/posts | Yes |
| Strapi dates | `"createdAt": "2024-03-06T13:42:05.098Z"` | https://docs.strapi.io/cms/api/rest | Yes |
| WordPress dates | `"date_gmt":"2026-10-21T13:44:09"`, no offset | https://wordpress.org/news/wp-json/wp/v2/posts?per_page=1 (live WordPress response) | Yes |
| WordPress `date` field | "The date the post was published, in the site's timezone." | https://developer.wordpress.org/rest-api/reference/posts/ | Yes |
| Sitemap `lastmod` | "This date should be in W3C Datetime format", a date alone is allowed | https://www.sitemaps.org/protocol.html | Yes |
| W3C Datetime | 6 forms; every form with a time has a TZD, "Z or +hh:mm or -hh:mm" | https://www.w3.org/TR/NOTE-datetime | Yes |
| HTTP dates | "the sender MUST generate those timestamps in the IMF-fixdate format", `Sun, 06 Nov 1994 08:49:37 GMT`, whole seconds | https://www.rfc-editor.org/rfc/rfc9110 section 5.6.7 | Yes |
| Feed and sitemap formats | "W3C Datetime for XML sitemaps, RFC3339 for Atom and RFC822 for RSS" | https://developers.google.com/search/blog/2014/10/best-practices-for-xml-sitemaps-rssatom (16 October 2014) | Yes, dated |
| OpenAPI `date-time` | "as defined by date-time - RFC3339", a `string` | https://spec.openapis.org/registry/format/date-time.html | Yes |
| Visible date | show a date and "feature it prominently", labelled; "Make your dates and times consistent"; "Don't specify future dates" | https://developers.google.com/search/docs/appearance/publication-dates (updated 10 December 2025) | Yes |
| Postgres `now()` | "return values based on the start time of the current transaction" | https://www.postgresql.org/docs/current/functions-datetime.html section 9.9.5 | Yes |
| BCP 47 case | "to be treated as case insensitive"; language lowercase, script title case, region uppercase | https://www.rfc-editor.org/rfc/rfc5646 section 2.1.1 | Yes |
| BCP 47 region | 2 letters from ISO 3166-1 or 3 digits from UN M.49 | same, section 2.2.4 | Yes |
| Google hreflang codes | "Only language codes listed in ISO 639-1 and region codes listed in ISO 3166-1 Alpha 2 are supported"; a script such as `zh-Hant` is allowed | https://developers.google.com/search/docs/specialty/international/localized-versions (updated 21 September 2026) | Yes |
| Region alone | "You can't specify the country code by itself." | same | Yes |
| hreflang case | "case-insensitive; Google accepts lowercase and uppercase codes" | same | Yes |
| `x-default` | "used when no other language/region matches the user's browser setting"; "recommended for specifying the fallback page" | same | Yes |
| Open Graph locale | `og:locale` "Of the format `language_TERRITORY`. Default is `en_US`." | https://ogp.me/ | Yes |
| schema.org `inLanguage` | "use one of the language codes from the IETF BCP 47 standard" | https://schema.org/inLanguage | Yes |
| Canonical casing in JavaScript | `Intl.getCanonicalLocales(["en-us","zh-hant-tw"])` gives `en-US`, `zh-Hant-TW` | Test | Test |

## 2. Errors and status codes

RFC 9457 replaced RFC 7807 and defines `application/problem+json`. A problem has `type`, `status`, `title`, `detail` and `instance`, and may carry extensions, which clients must ignore when unknown. A `type` URI should resolve to HTML documentation. Stripe, GitHub, Ghost and Strapi each have their own shape, and all of them pair a stable machine code with a human message. GitHub answers 404 rather than 403 so it never confirms that something private exists.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Media type | "application/problem+json" | https://www.rfc-editor.org/rfc/rfc9457 section 3 | Yes |
| Members | `type` (default "about:blank"), `status` ("only advisory"), `title`, `detail`, `instance` | same, section 3.1 | Yes |
| Unknown extensions | "Clients consuming problem details MUST ignore any such extensions that they don't recognize" | same, section 3.2 | Yes |
| Several problems | report "the most relevant or urgent problem"; the example defines an `errors` extension with `detail` and `pointer` | same, section 3 | Yes |
| Type URIs | "resolvable type URIs are encouraged"; consumers "SHOULD NOT automatically dereference" them | same, section 3.1.1 | Yes |
| Older RFC | "This document obsoletes RFC 7807." | same, abstract | Yes |
| Stripe error | `type` (`api_error`, `card_error`, `idempotency_error`, `invalid_request_error`), `code`, `message`, `param`, `doc_url`, `request_log_url` | https://docs.stripe.com/api/errors | Yes |
| Stripe codes | 400, 401 "No valid API key provided.", 402, 403, 404, 409, 424, 429 with "exponential backoff", 500 to 504 | same | Yes |
| GitHub 422 | body has `errors` with `code`: `missing`, `missing_field`, `invalid`, `already_exists`, `unprocessable`, `custom` | https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api | Yes |
| GitHub 404 for private | "uses a `404 Not Found` response instead of a `403 Forbidden`" | same | Yes |
| Ghost error | `errors` array with `message` ("Unknown Content API Key") and `errorType` ("UnauthorizedError"); codes 400, 401, 403, 404, 500 | https://docs.ghost.org/content-api/errors | Yes |
| Strapi error | `error` object with `status`, `name` ("NotFoundError"), `message`, `details` | https://docs.strapi.io/cms/api/rest | Yes |
| 401 | "MUST send a WWW-Authenticate header field" | https://www.rfc-editor.org/rfc/rfc9110 section 15.5.2 | Yes |
| 400 | "something that is perceived to be a client error" | same, section 15.5.1 | Yes |
| 404 | "did not find a current representation for the target resource or is not willing to disclose that one exists" | same, section 15.5.5 | Yes |
| 410 | "likely to be permanent"; "heuristically cacheable" | same, section 15.5.11 | Yes |
| 429 | "MAY include a Retry-After header"; "MUST NOT be stored by a cache" | https://www.rfc-editor.org/rfc/rfc6585 section 4 | Yes |

The status codes this API needs, from the facts above: 200; 304 for a matching `If-None-Match`; 400 for a bad parameter or cursor; 401 with `WWW-Authenticate: Bearer` for a missing or wrong key; 404 for an unknown page; 410 for an unpublished page or an expired sync token (section 3); 429 with `Retry-After`; 500 and 503.

## 3. Lists, pagination and deletion sync

Offset pagination repeats or skips rows when a row is inserted between two pages. Keyset pagination with a deterministic order, a unique column as tie-breaker and a row-value comparison does not, and Postgres supports it. Google's API rules ask for opaque, URL-safe tokens that clients cannot parse, a page size coerced down to the maximum, and the same filters on every page of one walk. GitHub and WordPress put the next page in a `Link` header from RFC 8288. Stripe, Ghost, GitHub and WordPress cap a page at 100; Ghost 6 removed fetching everything at once.

A list filtered by `updatedSince` cannot show a page that left the list. Every sync interface fetched returns a deletion record instead. Contentful returns `DeletedEntry`, Contentstack `entry_unpublished` and `entry_deleted`, Microsoft Graph an `@removed` object, Google Calendar deleted entries. Sanity keeps deletions in a history with a retention limit. Ghost and Storyblok push them by webhook. When a token is too old, Graph and Google Calendar answer 410 and the client starts again from empty. Graph warns that the same change can arrive twice.

Postgres `now()` is the start of the transaction (section 1). A row whose transaction started before a client's sync and committed after it carries an `updated_at` older than the client's next `updatedSince`, so that sync never returns it. This is an inference from the documented behaviour, not a quoted warning.

The list returns full page objects. Vercel caps a function's response at 4.5 MB. My estimate, not a measurement: a long page with `body.markdown`, `body.html`, `jsonLd` and `faq` weighs about 30 to 60 KB, so 200 of them weigh 6 to 12 MB.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Stripe list | `limit` "ranging between 1 and 100", default 10; cursors `starting_after` and `ending_before` are object ids; `has_more` | https://docs.stripe.com/api/pagination | Yes |
| GitHub list | `link` header with `rel="next"`, `prev`, `first`, `last`; "the maximum value of `per_page` is `100`" for most endpoints | https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api | Yes |
| WordPress list | "capped at 100 records"; `X-WP-Total` and `X-WP-TotalPages` headers | https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/ | Yes |
| WordPress `Link` | `link: <https://wordpress.org/news/wp-json/wp/v2/posts?…&page=2>; rel="next"` | https://wordpress.org/news/wp-json/wp/v2/posts?per_page=1 (live response headers) | Yes |
| Ghost list | "only 15 records are returned at once" by default; "&limit=100 will return 100 records (max)" | https://docs.ghost.org/content-api/parameters | Yes |
| Ghost 6 | "all endpoints now have a max page size of 100" | https://docs.ghost.org/jamstack | Yes |
| Strapi list | page size "Default: `25`"; maximum "set by `api.rest.maxLimit`" | https://docs.strapi.io/cms/api/rest | Yes |
| Token opacity | "must be opaque (but URL-safe) strings, and must not be user-parseable" | https://google.aip.dev/158 | Yes |
| Page size above the maximum | "coerce down to the maximum permitted page size" | same | Yes |
| Other parameters | "must match the call that provided the page token" | same | Yes |
| Token expiry | may expire; "a good rule of thumb is three days" | same | Yes |
| Offset anomaly | "you'll get duplicates in case there were new rows inserted between fetching two pages" | https://use-the-index-luke.com/no-offset | No |
| Deterministic order | "Paging requires a deterministic sort order"; add "any unique column(s)" | https://use-the-index-luke.com/sql/partial-results/fetch-next-page | No |
| Row values | `WHERE (sale_date, sale_id) < (?, ?)`; PostgreSQL supports them "since 8.4" | same | No |
| `Link` syntax | `"<" URI-Reference ">" *( OWS ";" OWS link-param )`, several links comma-separated, relative references resolved | https://www.rfc-editor.org/rfc/rfc8288 sections 3 and 3.1 | Yes |
| Relation names | compared "in a case-insensitive fashion"; `next`, `prev`, `first`, `last` are registered | same, section 2.1.1; https://www.iana.org/assignments/link-relations/link-relations.xhtml | Yes |
| Contentful deletions | `DeletedEntry` and `DeletedAsset`, which "do not contain full assets or entries" | https://contentful.com/developers/docs/references/content-delivery-api/synchronization.md | Yes |
| Contentful first sync | does "not contain content deleted" | same | Yes |
| Contentful lost token | the client "should delete its local content and perform an initial synchronization again" | same | Yes |
| Contentstack item types | `entry_published`, `entry_unpublished`, `entry_deleted`, `asset_unpublished` and others; tokens "don't have an expiry time"; more than 100 records gives a `pagination_token` | https://www.contentstack.com/docs/developers/apis/content-delivery-api/synchronization | Yes |
| Sanity deletions | history `transactions` endpoint, `documentIDs` and a `delete` mutation; history kept "3 days on Free, 90 days on Growth, and 365 days on Enterprise" | https://www.sanity.io/docs/developer-guides/find-and-restore-deleted-documents | Yes |
| Microsoft Graph deletions | "Removed instances are represented by their id and an @removed object", reason `changed` or `deleted` | https://learn.microsoft.com/en-us/graph/delta-query-overview | Yes |
| Microsoft Graph replays | "Your application must be prepared for replays" | same | Yes |
| Microsoft Graph reset | `410 Gone` means the client "must restart with a full synchronization"; directory tokens last 7 days | same | Yes |
| Google Calendar deletions | an incremental result "will always contain deleted entries" | https://developers.google.com/workspace/calendar/api/guides/sync | Yes |
| Google Calendar reset | an invalid token gets "a response code `410`", which "should trigger a full wipe" and a full sync | same | Yes |
| Ghost webhooks | `post.published`, `post.published.edited`, `post.unpublished`, `post.deleted` and 5 more | https://docs.ghost.org/webhooks | Yes |
| Storyblok change counter | `cv` is "a space-specific numeric counter (a Unix timestamp) that increments with each content change"; clients poll the space `version`, cached 2 seconds | https://www.storyblok.com/docs/api/content-delivery/v2/getting-started/cache-invalidation | Yes |
| Vercel response size | "The maximum payload size for the request body or the response body of a Vercel Function is 4.5 MB"; above it, 413 | https://vercel.com/docs/functions/limitations (updated 24 August 2026) | Yes |

## 4. Conditional requests and caching semantics

`If-None-Match` uses weak comparison, so a weak `W/` tag works for revalidation, and a GET with a match must get 304. A strong tag must differ between a gzip and an identity response, so compression on the way out changes what a strong tag promises. `Last-Modified` has whole-second resolution and is implicitly weak, and a server ignores `If-Modified-Since` when `If-None-Match` is present. A 304 repeats the `ETag`, `Cache-Control` and `Vary` the 200 would have had.

`s-maxage` sets the lifetime for shared caches only. A private cache, such as a fetch cache inside one customer's server, sees no `max-age`. It may then use a heuristic lifetime, because `public` marks the response cacheable. `stale-while-revalidate` comes from RFC 5861, which is Informational. Whether a shared cache may store a response to a request with `Authorization` is RFC 9111 section 3.5, covered in the access file.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| ETag syntax | `entity-tag = [ weak ] opaque-tag`, `weak = %s"W/"`; strong is the default | https://www.rfc-editor.org/rfc/rfc9110 section 8.8.3 | Yes |
| Strong and weak | strong "changes value whenever a change occurs to the representation data"; weak "might not change for every change" | same, section 8.8.1 | Yes |
| Weak use | "only usable when the client does not require exact equality" | same, section 8.8.1 | Yes |
| Compression and strong tags | the example uses `"123-a"` for identity and `"123-b"` for gzip; a strong tag for an encoded representation "has to be distinct" | same, section 8.8.3.3 | Yes |
| `If-None-Match` | "MUST use the weak comparison function"; a match on GET or HEAD MUST get 304 | same, section 13.1.2 | Yes |
| `If-Modified-Since` | "MUST ignore If-Modified-Since if the request contains an If-None-Match header field" | same, section 13.1.3 | Yes |
| `Last-Modified` as validator | "implicitly weak unless it is possible to deduce that it is strong" | same, section 8.8.2.2 | Yes |
| `Last-Modified` sending | "SHOULD send Last-Modified" when a date "can be reasonably and consistently determined" | same, section 8.8.2.1 | Yes |
| 304 headers | must include `Content-Location`, `Date`, `ETag`, `Vary`, `Cache-Control`, `Expires` that a 200 would have had | same, section 15.4.5 | Yes |
| Shared and private caches | shared: "for reuse by more than one user"; private: "dedicated to a single user" | https://www.rfc-editor.org/rfc/rfc9111 section 1 | Yes |
| `s-maxage` | "for a shared cache, the maximum age specified by this directive overrides" `max-age` or `Expires` | same, section 5.2.2.10 | Yes |
| `public` | "a cache MAY store the response even if it would otherwise be prohibited" | same, section 5.2.2.9 | Yes |
| Heuristic lifetime | allowed for explicitly cacheable responses such as `public`; "A typical setting of this fraction might be 10%" of the time since `Last-Modified` | same, section 4.2.2 | Yes |
| Authorization and shared caches | "A shared cache MUST NOT use a cached response to a request with an Authorization header field" unless allowed by section 3.5 | same, section 3.5 | Yes |
| `stale-while-revalidate` | caches "MAY serve the response … after it becomes stale, up to the indicated number of seconds" | https://www.rfc-editor.org/rfc/rfc5861 section 3 | Yes |
| RFC 5861 status | "not an Internet Standards Track specification" | same | Yes |
| Google and 304 | the content "is the same as last time it was crawled"; otherwise no effect on indexing | https://developers.google.com/search/docs/crawling-indexing/http-network-errors (updated 4 February 2026) | Yes |
| Next.js ETags | "Next.js will generate etags for every page by default"; the page says nothing of route handlers | `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/generateEtags.md` | Yes |

## 5. Versioning and change

GitHub and Stripe publish what they count as breaking and what as additive. Adding a field, an optional parameter, a header, an operation or an enum value is additive for both. Stripe also counts reordering fields and changing the length or format of opaque strings as compatible, and tells integrations to ignore unknown fields. Google's rules are stricter on enums and defaults. Stripe keeps `/v1` in the path and versions by a header with a date; GitHub and Ghost version by a header too. Deprecation and sunset have their own headers, written in two different date formats.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| GitHub breaking | removing an operation, removing or renaming a parameter or a response field, a new required parameter, changing a type, "Removing enum values", a new validation rule, changed authentication | https://docs.github.com/en/rest/about-the-rest-api/breaking-changes | Yes |
| GitHub additive | "Adding an operation", "Adding an optional parameter", "Adding a response field", "Adding a response header", "Adding enum values" | same | Yes |
| GitHub support | the previous version "will be supported for at least 24 more months" | same | Yes |
| GitHub version header | `X-GitHub-Api-Version`, examples `2022-11-28` and `2026-03-10` | https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api | Yes |
| Stripe compatible changes | new resources, new optional parameters, "Adding new properties to existing API responses", "Changing the order of properties", changing "the length or format of opaque strings", new event types | https://docs.stripe.com/api-versions | Yes |
| Stripe client rule | "Design your integration to ignore unfamiliar fields and event types." | same | Yes |
| Stripe versions | date-based, such as `2026-09-30.endive`, sent in `Stripe-Version`; path `/v1` | same; https://docs.stripe.com/upgrades | Yes |
| Ghost version header | `Accept-Version: v{major}.{minor}`, example `v6.0` | https://docs.ghost.org/content-api | Yes |
| Google: defaults | "Changing the default value is considered breaking and must not be done." | https://google.aip.dev/180 | Yes |
| Google: format | "must not change the expected format or algorithm used to construct the value of an existing field" | same | Yes |
| Google: response enums | "user code does not handle new values gracefully", so such enums "should document this" | same | Yes |
| Google: semantics | "must not change visible behavior or semantics in ways that are likely to break reasonable user code" | same | Yes |
| `Deprecation` header | a Structured Field Date, example `Deprecation: @1688169599`; a date in the future is allowed | https://www.rfc-editor.org/rfc/rfc9745 | Yes, Proposed Standard |
| `Sunset` header | `Sunset = HTTP-date`, example `Sunset: Sat, 31 Dec 2018 23:59:59 GMT` | https://www.rfc-editor.org/rfc/rfc8594 section 3 | Yes, Informational |
| Order of the two | "The timestamp given in the `Sunset` HTTP header field MUST NOT be earlier than the one given in the `Deprecation` header field." | https://www.rfc-editor.org/rfc/rfc9745 | Yes |
| Link relations | `deprecation` and `sunset` are registered | https://www.iana.org/assignments/link-relations/link-relations.xhtml | Yes |

## 6. A machine-readable contract and the integration guide

OpenAPI 3.1 aligned its Schema Object with JSON Schema 2020-12, and 3.2.0 followed in September 2025. Tools lag: openapi-generator has 81 client generators but marks 3.1 as beta. openapi-typescript, Postman, Redoc and Scalar read 3.1, and Redoc and Scalar are MIT-licensed. RFC 8631's `service-desc` relation lets a response point to the machine-readable description.

`llms.txt` is a proposal for an index file that agents read "on demand". No source fetched says a coding agent fetches it on its own, and Google Search ignores it ([GSC and IndexNow file, section 4.3](2026-10-13-seo-autopilot-gsc-indexnow.md#43-the-recent-blog-post-and-the-generative-ai-optimisation-guide)). What vendors do instead is serve every docs page as markdown: Wix, Stripe and Vercel all do so, with notes addressed to agents.

The guides compared start in one of two ways. Ghost, Strapi and Stripe start from a curl request, then the language clients. Storyblok has no framework-free quickstart, only 11 framework quickstarts. Ghost's "Custom Frontend" guide, its route for any other technology, is JavaScript only. Ghost also lists what a headless site must rebuild: sitemap, meta fallbacks, Open Graph and Twitter Cards.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Versions listed | 3.2.1, 3.2.0, 3.1.2, 3.1.1, 3.1.0, 3.0.4 to 3.0.0, 2.0 | https://spec.openapis.org/oas/ | Yes |
| 3.1.0 | published 15 February 2021; the Schema Object "is a superset of JSON Schema Specification Draft 2020-12" | https://spec.openapis.org/oas/v3.1.0.html | Yes |
| 3.2.0 | published 19 September 2025; adds a `QUERY` operation and sequential media types | https://spec.openapis.org/oas/v3.2.0.html | Yes |
| openapi-generator | 81 client generators, from `bash` and `php` to `swift6` and `typescript-fetch` | https://openapi-generator.tech/docs/generators | Yes |
| openapi-generator and 3.1 | "3.0, 3.1 (beta support)"; Apache-2.0 | https://github.com/OpenAPITools/openapi-generator | Yes |
| openapi-typescript | "turns OpenAPI 3.0 & 3.1 schemas into TypeScript"; MIT | https://openapi-ts.dev/introduction | Yes |
| Postman | "You can import your existing OpenAPI 3.0 and 3.1 definitions"; Spec Hub supports 2.0, 3.0 and 3.1 and can "generate a collection" | https://learning.postman.com/docs/integrations/available-integrations/working-with-openAPI | Yes |
| Scalar | MIT; renders OpenAPI documents with a request client; loads from a CDN "with no build step required" | https://github.com/scalar/scalar | Yes |
| Redoc | MIT; "Support for OpenAPI 3.2, OpenAPI 3.1, OpenAPI 3.0, and Swagger 2.0"; `npx @redocly/cli build-docs` writes static HTML | https://github.com/Redocly/redoc | Yes |
| `service-desc` | "service description for the context that is primarily intended for consumption by machines" | https://www.iana.org/assignments/link-relations/link-relations.xhtml | Yes |
| `llms.txt` | "A proposal to standardise on using an `/llms.txt` file"; only the H1 is required; offer pages as `.md`; by Jeremy Howard, 3 September 2024 | https://llmstxt.org/ | Yes |
| How it is read | "used on demand, when an agent needs information" | same | Yes |
| Wix docs | "Append `.md` to any URL"; publishes `llms.txt` and `llms-full.txt` | https://dev.wix.com/docs/velo/apis/wix-fetch/introduction.md | Yes |
| Stripe docs | each reference page offers `stripe docs` in a terminal and "skills and plugins for agents" | https://docs.stripe.com/api/errors | Yes |
| Vercel docs | a related-pages block headed "For AI agents" | https://vercel.com/docs/functions/limitations | Yes |
| Ghost Content API page | opens with `curl -H "Accept-Version: v6.0" "https://demo.ghost.io/ghost/api/content/posts/?key=…"` | https://docs.ghost.org/content-api | Yes |
| Ghost framework guides | Next.js, Gatsby, Hexo, Nuxt, VuePress, Gridsome, Eleventy, and Custom Frontend | https://docs.ghost.org/jamstack | Yes |
| Ghost Custom Frontend | JavaScript only: Content API, JavaScript Client, JavaScript SDK | https://docs.ghost.org/jamstack/custom | Yes |
| Ghost headless rebuild list | "Generated sitemap.xml for SEO", "Intelligent output and fallbacks for SEO meta data", "Automatic Open Graph structured data", "Automatic support for Twitter Cards" | https://docs.ghost.org/jamstack | Yes |
| Storyblok guides | "step-by-step quickstarts" for Astro, Next.js, Nuxt, React, Angular, Vue, Android, Compose Multiplatform, Apple platforms, Symfony, Svelte | https://www.storyblok.com/docs/guides | Yes |
| Strapi REST docs | a cURL tab and a JavaScript tab on every endpoint | https://docs.strapi.io/cms/api/rest | Yes |

## 7. Platforms that cannot fetch at render time

Sites fall into three groups by what they can do when a page is requested.

- Server code at request time, such as Next.js, Astro with a server, a PHP or WordPress theme, Rails or a Wix router, can call the API on each request.
- A build step, such as Hugo, Astro or Eleventy, can call the API at build time and needs a rebuild to show a change. The webhook research covers deploy hooks.
- A hosted builder that renders from its own CMS, such as Shopify, Webflow, Wix's blog, Squarespace and Framer, cannot call our API from its templates. A headless CMS reaches these platforms by pushing content into their CMS through their admin API, or not at all.

A plain HTML site has no request-time code, so it needs a build step, or JavaScript in the browser. Google renders JavaScript later in a queue, and "not all bots can run JavaScript". The key in a browser is the access file's subject.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Shopify Liquid | "Liquid objects represent variables"; data comes from store resources Shopify provides | https://shopify.dev/docs/api/liquid | Yes |
| Shopify tags | `if`, `for`, `assign`, `capture`, `liquid`; none fetches a URL | https://shopify.dev/docs/api/liquid/tags | Yes |
| Shopify app proxy | "App proxies take requests to Shopify URLs, and proxy them to your app"; prefix `a`, `apps`, `community` or `tools` | https://shopify.dev/docs/apps/build/online-store/app-proxies | Yes |
| App proxy with Liquid | with `application/liquid`, "Shopify renders any Liquid code … in the context of the shop using the shop's theme"; needs the `write_app_proxy` scope | same | Yes |
| Shopify push | `articleCreate` "Requires Any of `write_content`, `write_online_store_pages` access scopes"; inputs include `blogId`, `title`, `body`, `handle`, `author`, `summary`, `isPublished`, `publishDate` | https://shopify.dev/docs/api/admin-graphql/latest/mutations/articleCreate | Yes |
| Shopify tokens | "You can no longer create new admin-created custom apps"; new apps use the Dev Dashboard or Shopify CLI "with a proper OAuth flow" | https://shopify.dev/apps/auth/admin-app-access-tokens | Yes |
| Shopify sitemap | "All Shopify stores automatically generate a `sitemap.xml` file" with products, pages, collections and blog posts | https://help.shopify.com/en/manual/promoting-marketing/seo/find-site-map | Yes |
| Shopify robots.txt | `robots.txt.liquid` "replaces Shopify's generated `robots.txt`"; a section "Add extra sitemap URLs" | https://shopify.dev/docs/storefronts/themes/seo/robots-txt | Yes |
| WordPress push | `POST /wp/v2/posts` with `title`, `content`, `excerpt`, `slug`, `status`, `date_gmt`, `featured_media`, `categories`, `tags`, `meta` | https://developer.wordpress.org/rest-api/reference/posts/ | Yes |
| WordPress credentials | "As of 5.6, WordPress has shipped with Application Passwords", passed to requests "served over https://" | https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/ | Yes |
| WordPress pull in code | `wp_remote_get` "Performs an HTTP request using the GET method and returns its response" | https://developer.wordpress.org/reference/functions/wp_remote_get/ | Yes |
| WordPress pull by plugin, RSS | Feedzy "Feed to Post" brings "full RSS feed items into WordPress as fully editable posts"; one import project free, scheduled imports in Pro; 40,000+ installations | https://wordpress.org/plugins/feedzy-rss-feeds/ | Yes, the plugin's own listing |
| WordPress pull by plugin, XML | WP All Import imports CSV, XML or Excel from a URL, recurring imports in Pro; 100,000+ installations | https://wordpress.org/plugins/wp-all-import/ | Yes, the plugin's own listing |
| Webflow push | `POST https://api.webflow.com/v2/collections/{collection_id}/items`, scope `CMS:write`; `isDraft: false` queues the item for "the next site publish" | https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-item | Yes |
| Webflow limits | 60 requests a minute on Starter and Basic, 120 on CMS, eCommerce and Business; "one successful publish per minute" | https://developers.webflow.com/data/reference/rate-limits | Yes |
| Wix push | `POST https://www.wixapis.com/blog/v3/draft-posts`, content as Ricos `richContent` nodes; then `POST …/draft-posts/{draftPostId}/publish` | https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/create-draft-post; https://dev.wix.com/docs/api-reference/business-solutions/blog/draft-posts/publish-draft-post.md | Yes |
| Wix request-time code | a router handles "all incoming requests with a specified prefix", answers with `ok()`, `redirect()`, `notFound()`, `sendStatus()`, and has its own `sitemap()` | https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/routers/about-routers | Yes |
| Wix fetch | wix-fetch sends HTTPS requests "from your frontend or backend code"; backend is "more secure, especially if the API requires a key" | https://dev.wix.com/docs/velo/apis/wix-fetch/introduction.md | Yes |
| Squarespace APIs | Analytics, Contacts, Discounts, Inventory, Orders, Products, Profiles, Transactions, Webhook Subscriptions; none for posts or pages | https://developers.squarespace.com/commerce-apis/overview | Yes |
| Squarespace posting | "Update your blog on a computer or in the Squarespace app"; "You can't update your blog using an XML-RPC client." | https://support.squarespace.com/hc/articles/206543727 | Yes |
| Framer push | the Server API updates and publishes projects "with a simple script from any server"; `framer.publish()` and `framer.deploy()`; keys "bound to a specific project" | https://www.framer.com/developers/server-api-introduction; https://www.framer.com/developers/server-api-quick-start; https://www.framer.com/developers/server-api-reference | Yes |
| Framer CMS methods | `addItems` "for both adding new items as well as updating existing ones", `removeItems`, documented for plugins | https://www.framer.com/developers/cms | Yes |
| Hugo build-time fetch | `resources.GetRemote` with an `Authorization` header in `headers`; results "cached to disk" | https://gohugo.io/functions/resources/getremote/ | Yes |
| Astro | "Build-time content collections are updated at build time"; "Live content collections fetch their data at runtime" | https://docs.astro.build/en/guides/content-collections/ | Yes |
| Google and JavaScript | rendering waits in a queue that "can take longer"; "server-side or pre-rendering is still a great idea"; "not all bots can run JavaScript" | https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics (updated 4 March 2026) | Yes |

## 8. The page object

The page object in `docs/content-api.md` lines 22 to 44 already holds more SEO fields than Ghost or WordPress give. These are the gaps against Ghost, WordPress, Sanity's blog template and a Contentful blog example:

- an image: Ghost `feature_image` with alt and caption, WordPress `featured_media`, Sanity `coverImage` with alt, Contentful `coverImage`; ours has none, by the decision of 14 October 2026, and the page image file weighs the options
- social fields: Ghost `og_image`, `og_title`, `og_description` and three `twitter_*` fields; Open Graph requires `og:title`, `og:type`, `og:image` and `og:url`
- a primary tag: Ghost `primary_tag`
- self and `x-default` in the hreflang set: Google requires each version to list itself, while ours lists "other language versions" only
- visible breadcrumbs: our `jsonLd` holds a `BreadcrumbList` with no field for the template to show
- a table of contents and a word count: no compared CMS returns either, though our headings already carry ids; schema.org has `wordCount`

Robots directives appear in none of the compared post objects. A published Citequill page is meant to be indexed.

Google's rules decide what the customer's template must show so the `jsonLd` stays true. Markup must describe visible content, and every author shown must be in the markup ([structured data file, site-wide rules and section 1](2026-10-19-structured-data.md#1-article)). The visible date must match the structured one. So the template shows the author's name, linked to `author.url`, the published date, the updated date when it differs, the H1 equal to `headline`, and breadcrumbs equal to the `BreadcrumbList`.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Ghost post fields | `slug`, `id`, `uuid`, `title`, `html`, `comment_id`, `feature_image`, `feature_image_alt`, `feature_image_caption`, `featured`, `visibility`, `created_at`, `updated_at`, `published_at`, `custom_excerpt`, `codeinjection_head`, `codeinjection_foot`, `custom_template`, `canonical_url`, `url`, `excerpt`, `reading_time`, `access`, `og_image`, `og_title`, `og_description`, `twitter_image`, `twitter_title`, `twitter_description`, `meta_title`, `meta_description`, `email_subject` | https://docs.ghost.org/content-api/posts | Yes |
| Ghost includes | `&include=authors,tags` adds `authors`, `tags`, `primary_author`, `primary_tag` | same | Yes |
| Ghost formats | "By default, only `html` is returned"; `formats=html,plaintext` adds plain text | https://docs.ghost.org/content-api/parameters | Yes |
| WordPress post fields | `date`, `date_gmt`, `guid`, `id`, `link`, `modified`, `modified_gmt`, `slug`, `status`, `type`, `password`, `permalink_template`, `generated_slug`, `title`, `content`, `author`, `excerpt`, `featured_media`, `comment_status`, `ping_status`, `format`, `meta`, `sticky`, `template`, `categories`, `tags` | https://developer.wordpress.org/rest-api/reference/posts/ | Yes |
| Sanity blog template post | `title`, `slug`, `content`, `excerpt`, `coverImage` with `alt`, `date`, `author` as a reference to `person` | https://raw.githubusercontent.com/sanity-io/sanity-template-nextjs-clean/main/studio/src/schemaTypes/documents/post.ts | Yes, Sanity's own template |
| Contentful blog example | `slug`, `title`, `coverImage.url`, `date`, `author` with `name` and `picture`, `excerpt`, `content` as rich text JSON | https://raw.githubusercontent.com/vercel/next.js/canary/examples/cms-contentful/lib/api.ts | No, Vercel's example |
| Open Graph required | "The four required properties for every page are": `og:title`, `og:type`, `og:image`, `og:url` | https://ogp.me/ | Yes |
| Open Graph image alt | "If the page specifies an og:image it should specify `og:image:alt`." | same | Yes |
| Open Graph article | `article:published_time`, `article:modified_time`, `article:author`, `article:section`, `article:tag`, dates in ISO 8601 | same | Yes |
| `wordCount` | "The number of words in the text of the CreativeWork", an Integer, on Article | https://schema.org/wordCount | Yes |
| hreflang self | "Each language version must list itself as well as all other language versions." | https://developers.google.com/search/docs/specialty/international/localized-versions | Yes |
| hreflang URLs | "Alternate URLs must be fully-qualified, including the transport method" | same | Yes |
| Reciprocity | "If two pages don't both point to each other, the tags will be ignored." | same | Yes |
| Visible and structured dates agree | "Make your dates and times consistent." | https://developers.google.com/search/docs/appearance/publication-dates | Yes |

## 9. The sitemap endpoint

The sitemap protocol asks for UTF-8, entity-escaped values, absolute URLs under 2,048 characters, at most 50,000 URLs and 50 MB uncompressed per file, and `lastmod` in W3C Datetime. hreflang in a sitemap needs the `xhtml` namespace and an `xhtml:link` for every alternate, the page itself included. Google's `lastmod` rules and index-file limits are in the [GSC and IndexNow file, sections 3.1 and 3.2](2026-10-13-seo-autopilot-gsc-indexnow.md#3-googles-sitemap-guidance-and-pickup-speed).

The new fact is where a sitemap may live. Google's cross-submission example hosts a site's sitemap on another host and names it in the site's own robots.txt, and that method needs no Search Console verification. The protocol says the same: the robots.txt line proves ownership. The 13 October file recorded only the Search Console method, which does need verification. Shopify lets a theme add an extra sitemap URL to robots.txt.

Feeds are a second channel, not a replacement. Google accepts RSS 2.0 and Atom 1.0 as sitemaps but reads them as recent changes only, and in 2014 it recommended using both. WordPress plugins can turn an RSS feed into posts (section 7).

| Fact | Value | Source | Primary? |
|---|---|---|---|
| File limits | "no more than 50,000 URLs" and "no larger than 50MB (52,428,800 bytes)" uncompressed | https://www.sitemaps.org/protocol.html | Yes |
| Encoding | "The file itself must be UTF-8 encoded"; "All data values in a Sitemap must be entity-escaped" | same | Yes |
| `loc` | begins with the protocol; "must be less than 2,048 characters" | same | Yes |
| `lastmod` meaning | "the date the linked page was last modified, not when the sitemap is generated" | same | Yes |
| Cross-host by robots.txt, protocol | URLs must sit on the sitemap's host unless the host proves ownership, for example by naming the sitemap in its robots.txt | same | Yes |
| Cross-host by robots.txt, Google | "Upload all sitemaps to a single site you have control over" and make each site's "robots.txt file references the sitemap"; the example hosts it on `sitemaps.example.com` | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap (updated 8 July 2026) | Yes |
| Cross-host by Search Console | needs "verified ownership of all the sites" | same | Yes |
| Parent directory | "a sitemap affects only descendants of the parent directory", unless submitted in Search Console | same | Yes |
| Google limits | "All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs." | same | Yes |
| Google formats | XML, "RSS, mRSS, and Atom 1.0", text; a feed "only provides information on recent URLs" | same | Yes |
| hreflang in a sitemap | `xmlns:xhtml="http://www.w3.org/1999/xhtml"`; each `<url>` has `<xhtml:link rel="alternate" hreflang>` listing "every alternate version of the page, including itself" | https://developers.google.com/search/docs/specialty/international/localized-versions | Yes |
| Sitemaps and feeds together | "we recommend using both XML sitemaps and RSS/Atom feeds"; feeds "describe recent changes" and "should have all updates in it since at least the last time Google downloaded it" | https://developers.google.com/search/blog/2014/10/best-practices-for-xml-sitemaps-rssatom (16 October 2014) | Yes, dated |
| JSON Feed | `version`, `title`, `items` required; item `id` required; `date_published` and `date_modified` "in RFC 3339 format"; MIME `application/feed+json` | https://www.jsonfeed.org/version/1.1/ | Yes |
| Shopify | an auto-generated `sitemap.xml`, and robots.txt can add extra sitemap URLs | section 7 | Yes |
| Wix routers | a router's `sitemap()` returns entries with URL, title and name for "router pages" | https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/routers/about-routers | Yes |

## 10. Redirect semantics

For Google, 301 and 308 are the same, and so are 404 and 410: every 4xx but 429 removes an indexed URL. HTTP still tells them apart. A 301 lets a client turn a POST into a GET, which a 308 forbids, and a 410 says the absence is likely permanent. All of 301, 404 and 410 are heuristically cacheable. Google says to keep redirects for at least 1 year after a move. Shopify redirects only from URLs that answer 404, and its help page names only 301 redirects.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Permanent redirects | "HTTP 301 (moved permanently)", "HTTP 308 (moved permanently)", instant meta refresh, JavaScript location | https://developers.google.com/search/docs/crawling-indexing/301-redirects (updated 14 April 2026) | Yes |
| What permanent means | "the indexing pipeline uses the redirect as a signal that the redirect target should be canonical" | same | Yes |
| JavaScript redirects | "Only use JavaScript redirects if you can't do server-side or `meta refresh` redirects." | same | Yes |
| 308 for Google | "Equivalent to 301" | https://developers.google.com/search/docs/crawling-indexing/http-network-errors | Yes |
| 4xx for Google | "All 4xx errors, except 429, are treated the same"; the pipeline "removes the URL from the index if it was previously indexed" | same | Yes |
| How long to redirect | "Keep the redirects for as long as possible, generally at least 1 year." | https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes (updated 20 August 2026) | Yes |
| 301 and methods | "a user agent MAY change the request method from POST to GET"; else "the 308 (Permanent Redirect) status code can be used instead" | https://www.rfc-editor.org/rfc/rfc9110 section 15.4.2 | Yes |
| Caching | 301, 404 and 410 are each "heuristically cacheable" | same, sections 15.4.2, 15.5.5, 15.5.11 | Yes |
| Shopify redirects | "You can redirect only from broken URLs"; "301 redirects are cached by browsers and search engines." | https://help.shopify.com/en/manual/online-store/menus-and-links/url-redirect | Yes |
| Shopify API | `urlRedirectCreate` with `path` and `target`, scope `write_online_store_navigation` | https://shopify.dev/docs/api/admin-graphql/latest/mutations/urlRedirectCreate | Yes |

## Design implications for Citequill

### One date format in every response

Options:

- pass the strings Postgres gives: no code, but variable precision and `+00:00` (section 1)
- Unix seconds like Stripe: no parsing trouble, but unreadable and second-only, and every page output (JSON-LD, sitemap, Open Graph) needs a string anyway
- RFC 3339 in UTC with `Z` and exactly 3 fractional digits, `2026-10-15T06:12:00.000Z`: the one format JavaScript parses for certain, it sorts as a string, has no `+` to break a query string, matches OpenAPI `date-time` and JSON Feed, and is what `Date.prototype.toISOString()` writes

Recommendation: the third, from one serialiser for the API, the webhook and the sitemap. Store timestamps truncated to milliseconds, or compare `updatedSince` at millisecond precision, so a value a client echoes back never returns the same page again. Accept `updatedSince` in any RFC 3339 offset, and say in the guide to percent-encode `+`. `docs/content-api.md` line 39, "ISO 8601", becomes the exact format, line 13 names it for `updatedSince`, and the webhook example on line 60 gains the milliseconds.

### Which time `updatedAt` reports

`updated_at` mixes two things today: the row changed, written by every editor save, and the content changed, written by publishing (`docs/workflow.md` line 69). Google wants `lastmod` and `dateModified` to move only on meaningful changes ([GSC and IndexNow file, section 3.1](2026-10-13-seo-autopilot-gsc-indexnow.md#31-lastmod)). A sync wants every change, unpublishing included.

Options:

- the editor stops writing `updated_at` on published pages: one fix, but the column keeps both meanings
- a separate content date, `modified_at`, written only by publishing, which feeds `updatedAt`, `dateModified`, `lastmod` and `article:modified_time`, while `updated_at` stays the sync clock

Recommendation: the second. `docs/data-model.md` line 50 gains the column, and `docs/workflow.md` lines 69 and 73 say which step writes which.

### A sync that never misses a page

Because `now()` is the transaction start, a page can commit with an `updated_at` older than a client's last sync (section 3).

Options:

- keep the client-built `updatedSince` and tell clients to subtract a margin: simple, but every client must get it right
- a server-issued opaque sync token, like Contentful, Google Calendar and Microsoft Graph: the server encodes a time some seconds before its own clock, so items overlap, and the contract says an item can arrive twice, as Graph does

Recommendation: the second, with `updatedSince` kept for a first sync by date. An expired or invalid token gets 410 with a problem body, and the client syncs from empty, the Graph and Calendar rule. `docs/content-api.md` line 13 changes.

### How a client learns a page is gone

Options:

- tombstones in the sync: with a sync token or `updatedSince`, `GET /pages` also returns `{ id, locale, path, status: "unpublished", unpublishedAt, redirect }` for pages unpublished since then
- `GET /redirects` gains `pageId`, `locale`, `unpublishedAt` and an `updatedSince` filter
- a separate changes feed

Recommendation: tombstones in the sync, the pattern of every sync API in section 3, and the extra fields on `/redirects`, which stays the full redirect map. Without a sync parameter, `GET /pages` keeps returning published pages only. `docs/content-api.md` lines 13, 15 and 72 change.

### The list: cursor, order, limits

Recommendation:

- an opaque cursor that encodes the sort key, the id and the filters, with the order `(updated_at, id)` for a sync and `(published_at, id)` otherwise (section 3)
- `nextCursor` in the body and the same URL in `Link: <…>; rel="next"`, which WordPress and GitHub clients already follow
- default 20 and maximum 50 full pages, a size above the maximum coerced down as Google's rules say, against today's default 50 and maximum 200

Measure a long page before fixing the numbers, because the 4.5 MB cap is a hard 413 (section 3). `docs/content-api.md` line 13 changes.

### Errors

Recommendation: every error as `application/problem+json` with `type`, `title`, `status`, `detail` and a stable `code` extension; `type` points to a page of the guide. A 401 sends `WWW-Authenticate: Bearer`. Clients key on `code`, never on `detail`, the Stripe and GitHub pattern. `docs/content-api.md` line 7 changes and the document gains an "Errors" section with the status codes listed in section 2.

### An unpublished page asked for by slug

A site that renders on request gets 404 for an unpublished slug today and must call `/redirects` to choose between 301 and 410.

Options:

- keep 404
- answer 410 with a problem body that carries `redirectStatus` (301 or 410) and `redirectTo`, so one request tells the site what to answer its visitor

Recommendation: the second. 410 is the HTTP code for "likely to be permanent" (section 2). `docs/content-api.md` lines 14 and 72 change.

### Caching headers

Recommendation:

- add a directive for private caches, `max-age=0`, so a customer's own cache revalidates with the `ETag`, alongside whatever shared-cache directive the access research settles
- use a weak `ETag` from a hash of the response body, because `If-None-Match` compares weakly anyway and a strong tag would be wrong once the response is compressed
- send `Last-Modified` only on single pages, as a secondary validator, because it is second-only and ignored next to `If-None-Match`
- make every 304 repeat `ETag`, `Cache-Control` and `Vary`

The facts are in section 4. `docs/content-api.md` line 18 changes.

### Versioning policy

Recommendation: keep `/v1`. Publish GitHub's list of additive changes as ours, with "ignore unknown fields and unknown enum values" as the client rule, Stripe's sentence. Removals ship only in `/v2`, announced on `/v1` responses with `Deprecation`, `Sunset` and `Link: rel="deprecation"`. Mind the two date formats of the two headers. New section in `docs/content-api.md`.

### OpenAPI and the guide

Options for the contract: OpenAPI 3.0 for the widest generator support, 3.1 for JSON Schema alignment, 3.2 for the newest features. Recommendation: 3.1 restricted to plain schemas (objects, strings, enums, arrays, `format: date-time`), so openapi-generator's beta 3.1 support still works. Serve it at `https://citequill.com/api/v1/openapi.json` and point to it with `Link: <…>; rel="service-desc"`. Render it with Scalar or Redoc, both MIT. Serve each guide page as markdown too, with an `llms.txt` index; that is cheap, but no source shows an agent reading it unasked.

The guide: a curl quickstart first, as Ghost, Strapi and Stripe do, then one recipe per site group from section 7, not per framework.

- Server code at request time: a generic request, with examples in Next.js, PHP and one other language.
- A build step: fetch at build time, then the webhook triggers a deploy hook.
- A hosted builder: say plainly what works today and what waits for push connectors.

`docs/content-api.md` line 3 changes.

### The "for every site" promise

`docs/product.md` line 11 and `docs/content-api.md` line 3 assume only a domain and an HTTP request. Shopify, Squarespace, Webflow, Wix's blog and Framer fail that test for render-time reads (section 7).

Options:

- narrow the promise for step 5: the Content API serves sites with server code or a build step, and push connectors serve the rest
- move push connectors forward, starting with Shopify `articleCreate` and the WordPress REST API: this needs OAuth or app review on Shopify (no new admin-created custom apps) and stored credentials per site
- the XML sitemap and an Atom feed as no-code channels for platforms that can edit robots.txt or import a feed

Recommendation: the first for step 5, with the third where it is cheap, and a decision in `docs/decisions.md` that the backlog entry for push connectors (line 887) names Shopify and WordPress first. The owner should make this call, because it changes a principle.

### Locale codes and the hreflang set

Recommendation:

- write `locale` as canonical BCP 47 (`en-US`) and accept any case in the path
- give every translation an `hreflang` value Google accepts, which differs from the locale only when the region is UN M.49
- add `ogLocale` (`en_US`)
- turn `translations` into `alternates`, listing the page itself and `x-default` pointing to the main locale's version, so the template copies the list into `<link>` tags unchanged

The facts are in sections 1 and 8. `docs/content-api.md` lines 26 and 30 change, and `docs/data-model.md` line 13 should say the stored form.

### Fields the page object gains

Recommendation:

- `breadcrumbs: [{ name, url }]`, equal to the `BreadcrumbList` in `jsonLd`
- `toc: [{ id, text, level }]` from the heading ids already in `body.html`
- `wordCount`
- `primaryTag`, the first tag
- `openGraph`, ready values for `og:title`, `og:type` `article`, `og:url`, `og:locale` and the `article:*` dates
- an `image` field, decided by the page image research

The guide's template checklist names what must be visible: the H1 equal to `headline`, the byline linked to `author.url`, the published date, the updated date when it differs, and the breadcrumbs. `docs/content-api.md` lines 22 to 46 change.

### The sitemap endpoint

Options:

- JSON only, as now: every customer writes XML, escaping, hreflang and limits
- ready XML at a public URL per project with no key, for example on `citequill.com` by the public `site_id`, named in the site's robots.txt: no code on the site, Google accepts it without verification (section 9), and it holds only URLs that are public anyway
- both

Recommendation: both. The XML has `lastmod` from the content date in the format above, `xhtml:link` alternates including self and `x-default`, and a sitemap index once a project passes 50,000 URLs. The JSON stays for sites that merge entries into their own sitemap. `docs/content-api.md` line 16 changes, and `docs/data-model.md` line 19 notes a second public use of `site_id`.

### A feed

Options: none, Atom, JSON Feed. Atom gives Google a channel for recent changes and gives WordPress a no-code import through existing plugins. JSON Feed reaches neither. Recommendation: an Atom feed of recent pages per project and locale, public like the XML sitemap, after the sitemap ships, because both read the same rows.

### Redirect semantics

Recommendation: keep the 301 and 410 choice. The guide says that 308 and 404 are acceptable where a platform offers nothing else, because Google treats them the same, and that on Shopify a redirect only works once the old URL answers 404. Keep every redirect in `/redirects` for at least 1 year, so never purge it. `docs/content-api.md` lines 15 and 72 change.

## Could not confirm

- Whether Contentful's sync reports an unpublished entry as a `DeletedEntry`. The page does not say. Contentful's other pages answered a Vercel security checkpoint, so the Delivery API's default and maximum `limit` were not read.
- GitHub's default `per_page` and the JSON body of a GitHub error, with `message` and `documentation_url`. The pages fetched do not show them.
- An official Shopify sentence that Liquid cannot make HTTP requests. The tag list has no such tag; the explicit statements found were community posts, which I did not fetch.
- The status code of Shopify's URL redirects. The help page names 301 only in its caching note.
- What Squarespace's "Websites" API does. Its sidebar lists it, but the overview fetched describes only the commerce APIs.
- Whether Squarespace robots.txt can be edited. The only sources were third parties found by search, not fetched.
- Whether Framer's Server API exposes the CMS methods (`addItems`, `removeItems`) or only `publish` and `deploy`. The reference page defers to another page.
- Whether any coding agent reads `llms.txt` without being told to. No primary source says so.
- Whether Next.js 16 generates an `ETag` or answers 304 for a route handler. Its docs speak only of pages.
- The ECMA-262 text of the date format. The spec pages were too long to read; the quote is from MDN.
- The size of a real Citequill page object. The 30 to 60 KB figure is an estimate to measure.
- Whether a shared cache may hold an authenticated response under these headers. That is the access research.

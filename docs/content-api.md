# Content API

The customer's site reads published pages from here. Citequill tells the site of every change through a webhook and tells search engines through IndexNow. The API assumes that the site can send an HTTP request from its server or its build and insert HTML or markdown; all the SEO and GEO logic is on our side. A site that cannot, a hosted builder such as Shopify, Wix or Webflow, WordPress, or a plain HTML site with no build step, waits for the push connectors in the backlog of [`decisions.md`](decisions.md). Base URL: `https://citequill.com/api/v1`. The API runs with no session and no cookies.

The API, the sitemaps and the webhook show only live pages: pages whose `status` is `published`. A page unpublished after its first publication keeps its published version, but no answer shows it as a page.

## Paths and keys

Every path of a project starts with `/sites/{siteId}`, where `siteId` is the project's public `site_id`, the one the analytics snippet will carry, in the format [`data-model.md`](data-model.md) gives. A request sends a key in `Authorization: Bearer <key>`. A key never travels in a query string, and `v1` sends no CORS headers, because a key belongs on a server and never in a browser.

A project has up to 10 keys, made in Settings, Integration. At 10 the Create key button is off, with a sentence that says to delete one first, and the database refuses an 11th. Each key has a name, such as Production or Preview. Citequill shows a key in full once, when it is made, and after that only its hint, the prefix and the last 6 characters, with the day it was last used. Deleting a key revokes it at once. To rotate a key, make a new one, switch the site to it and delete the old one; both work in between.

A key is `cq_sk_`, then 32 random bytes in Base62, padded to 43 characters, then a 6-character checksum: the CRC32 of the 43 characters, in Base62, padded to 6. So a mistyped key is refused before the database is asked. Citequill stores the key's SHA-256 only. A key has no expiry and no scope: every key reads the project's live pages and nothing else.

## Errors

An error is an RFC 9457 problem, `application/problem+json`, with `type` (the URL of its page in the guide), `title`, `status`, `detail` and `code`, a stable string a client may branch on; `detail` is for people and may change.

| Request                                                                     | Status | `code`               |
| --------------------------------------------------------------------------- | ------ | -------------------- |
| no `Authorization` header                                                   | 401    | `missing_key`        |
| a key that does not exist, was deleted or fails its checksum                | 401    | `invalid_key`        |
| a valid key on another project's path                                       | 403    | `wrong_site`         |
| a malformed or unknown parameter                                            | 400    | `invalid_parameter`  |
| a cursor that is malformed or does not fit the request                      | 400    | `invalid_cursor`     |
| no page with that locale and slug was ever published                        | 404    | `page_not_found`     |
| a `siteId` no project has, on a path that takes no key                      | 404    | `site_not_found`     |
| a host that is not among the project's locales                              | 404    | `host_not_found`     |
| a page that is unpublished                                                  | 410    | `page_unpublished`   |
| a sync token older than 30 days, or not a token at all                      | 410    | `sync_token_invalid` |
| more than 600 requests in a minute from one IP address, from the firewall   | 429    | none                 |
| any request while Vercel has paused the deployment, `503 DEPLOYMENT_PAUSED` | 503    | none                 |

A 401 carries `WWW-Authenticate: Bearer realm="citequill"`, and an `invalid_key` adds `error="invalid_token"`. The 429 and the 503 come from Vercel before our code runs, so they carry Vercel's own body, not a problem. The 429 carries `Retry-After`.

The rate limit is one rule of Vercel's firewall on `/api/v1`, by IP address, set in the Vercel project's firewall settings. It is the only limit that stops a request before it runs a function. It is high because many customers' sites run on Vercel and send from the same addresses. The firewall counts per region, and Hobby includes 1 000 000 requests the rule allows; Vercel does not say what happens past them.

The Hobby plan has one such rule and 1 000 000 function invocations a month. Past them the deployment is paused and answers `503 DEPLOYMENT_PAUSED` to every visitor, the dashboard included, for 30 days, and Vercel does not resume it on its own.

## Caching

Every answer carries `Cache-Control: private, no-cache` and a weak `ETag`, a hash of the body. A request whose `If-None-Match` matches gets 304 with the same `ETag` and `Cache-Control`. A single page also carries `Last-Modified` from its published version's `updated_at`, which moves when its `alternates` change too. No answer is cached on a CDN: Vercel's CDN stores no answer to a request with `Authorization`, and an answer marked `public` could be stored by a shared cache between the site and Citequill.

On our side the answers are cached per project. The cache is cleared at once when a page is published, changed or unpublished, when a key is deleted, when the owner edits an author, the organization, a kind or a locale in Settings, and when the crawl fills in the organization's empty logo or profiles, because the answers read those live.

Every request runs a function on our side, so a site caches too. It refreshes a page when the webhook says the page changed, and otherwise asks no more often than every few minutes, with the `ETag` it holds.

## Formats

- Dates in JSON and XML bodies are RFC 3339 in UTC with `Z` and exactly 3 fractional digits, `2026-10-15T06:12:00.000Z`: in the API's answers, the webhook's body, the sitemaps and the JSON-LD. One serializer writes them all. `updatedSince` accepts any RFC 3339 offset, and a `+` in it is sent as `%2B`, because a bare `+` in a query string is a space. HTTP headers keep their standard formats: `Last-Modified` and `Sunset` are IMF-fixdates, `Deprecation` an `@` and Unix seconds.
- A locale is a language, or a language and a two-letter country, in canonical BCP 47: `pl` or `en-US`. A path accepts it in any case. `hreflang` is the same value, which Google accepts, and `ogLocale` its Open Graph form, `en_US`. The crawl stores a locale with a region Google does not accept, such as `es-419`, as its language, `es`.
- Field names are camelCase. A client ignores the fields and the enum values it does not know.

## Endpoints

| Method and path                               | Returns                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /sites/{siteId}/pages`                   | the live pages, newest first publication first, filters `locale` and `kind` (the kind's name); `limit` 20 by default and 50 at most, a larger value lowered to 50; `cursor` from the previous answer; `{ pages, nextCursor }`, and the next page also as `Link: <…>; rel="next"` |
| `GET /sites/{siteId}/pages?sync=…`            | the changes since a sync token, in the section below                                                                                                                                                                                                                             |
| `GET /sites/{siteId}/pages/{locale}/{slug}`   | one live page; 410 `page_unpublished` when it is unpublished, with what to answer; 404 `page_not_found` when no page with that locale and slug was ever published                                                                                                                |
| `GET /sites/{siteId}/redirects`               | a removal record for every unpublished page, in the shape below, newest `unpublishedAt` first; `limit` 500 by default and 1 000 at most, with the cursor and `Link` of the list                                                                                                  |
| `GET /sites/{siteId}/sitemap`                 | `{ url, lastmod, alternates }` for every live page, newest first publication first, for a site that merges them into its own sitemap; `limit` 500 by default and 1 000 at most, with the cursor and `Link` of the list                                                           |
| `GET /sites/{siteId}/sitemaps/{host}.xml`     | the ready XML sitemap of one host of the project, with no key: the `urlset` when one file holds the host's pages, else a sitemap index of the files below                                                                                                                        |
| `GET /sites/{siteId}/sitemaps/{host}/{n}.xml` | file `n` of a host's sitemap, numbered from 1, with no key                                                                                                                                                                                                                       |
| `GET /sites/{siteId}/indexnow-key.txt`        | the project's IndexNow key alone, as `text/plain; charset=utf-8`, with no key, for a site that proxies its key file here                                                                                                                                                         |
| `GET /openapi.json`                           | the OpenAPI 3.1 document of `v1`, with no key                                                                                                                                                                                                                                    |

A cursor is opaque: it holds the order's key, the id and the filters, so a client sends it back as it came. The list and the JSON sitemap are ordered by first publication, `pages.published_at`, and id; `/redirects` by `unpublishedAt` and id; the sync by its own clock and id.

A removal record, in `/redirects` and in the sync, is `{ id, locale, path, url, status: "unpublished", unpublishedAt, redirect }`. `path` and `url` are the address the page was published under. `redirect` is `{ status: 301, to }`, where `to` is an absolute URL, or `null` when the page answers 410.

The 410 for an unpublished page carries the page's `redirect` as an extension member of the problem. A site that renders on request answers its visitor with 301 and `redirect.to`, or with 410 when `redirect` is `null`, so it needs one call. An unpublished page is in neither the list nor the sitemaps. It is in `/redirects` for as long as it stays unpublished.

## Sync

A site that keeps a copy of the pages, in a build or a cache of its own, asks for what changed instead of the whole list. The first sync is `?sync=start`, or `?updatedSince=<date>` to start from a date. The answer pages like the list, with the same `limit`, and its last page carries `nextSyncToken`; the next sync sends `?sync=<token>`. `sync` takes no `locale` or `kind` filter, and answers one with 400 `invalid_parameter`.

An answer holds every page that changed since the token, once, in its state now: a page object when it is live, a removal record when it is not. A client tells them apart by `status`, `published` or `unpublished`. A page unpublished and published again within one window comes back as a page object only.

A page changed when its published version changed, when its `alternates` changed because another language version of it was published or unpublished, when it was unpublished, when the owner edited in Settings an author, the organization, a kind or a locale the page shows, or when the crawl filled in the organization's empty logo or profiles. The token holds a time a few seconds before the server's clock, so a page can arrive twice and never not at all; a client keys pages by `id`. A token older than 30 days, or not a token at all, gets 410 with `code` `sync_token_invalid`, and the client syncs again from `start`.

## Page object

| Field                            | Content                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                             | identifier                                                                                                                                                                                                                                                                                                                                                                                            |
| `status`                         | `published`, which tells a page object from a removal record in the sync                                                                                                                                                                                                                                                                                                                              |
| `kind`                           | name of the kind from the project                                                                                                                                                                                                                                                                                                                                                                     |
| `locale`, `hreflang`, `ogLocale` | the locale in BCP 47, its hreflang value and its Open Graph form                                                                                                                                                                                                                                                                                                                                      |
| `slug`                           | last segment of the URL                                                                                                                                                                                                                                                                                                                                                                               |
| `path`                           | full path on the customer's site, from the locale's base URL, as it was when the page was first published                                                                                                                                                                                                                                                                                             |
| `url`, `canonical`               | full URL; `canonical` is the same                                                                                                                                                                                                                                                                                                                                                                     |
| `alternates`                     | list of `{ hreflang, url }`: every live language version, the page itself included, and `x-default` for the version in the main locale when it is live; the template copies it into `<link rel="alternate" hreflang>` tags as it stands                                                                                                                                                               |
| `title`                          | H1                                                                                                                                                                                                                                                                                                                                                                                                    |
| `metaTitle`                      | `<title>`                                                                                                                                                                                                                                                                                                                                                                                             |
| `metaDescription`                | meta description                                                                                                                                                                                                                                                                                                                                                                                      |
| `excerpt`                        | one paragraph for lists and Open Graph                                                                                                                                                                                                                                                                                                                                                                |
| `body`                           | `{ markdown, html }`, both from the same source and cleaned alike: the markdown has raw HTML removed, only the link schemes of the HTML kept and a `#` heading demoted to `##`; the HTML keeps the contract below                                                                                                                                                                                     |
| `toc`                            | list of `{ id, text, level }` from the headings of `body.html`, the footnotes heading left out, for a table of contents                                                                                                                                                                                                                                                                               |
| `faq`                            | list of `{ question, answer }`                                                                                                                                                                                                                                                                                                                                                                        |
| `sources`                        | list of `{ title, url }` from the research                                                                                                                                                                                                                                                                                                                                                            |
| `tags`, `primaryTag`             | list, and the first of it                                                                                                                                                                                                                                                                                                                                                                             |
| `author`                         | `{ name, jobTitle, url, sameAs }`, read from Settings when the answer is made                                                                                                                                                                                                                                                                                                                         |
| `publisher`                      | `{ name, url, logo, sameAs }`, `logo` as `{ url, width, height }` or `null` when the project has none, read from Settings when the answer is made                                                                                                                                                                                                                                                     |
| `breadcrumbs`                    | list of `{ name, url }`: the locale's home under the organization's name, the kind's address under the kind's name when the kind has a URL prefix, and the page; the same as the `BreadcrumbList` in `jsonLd`                                                                                                                                                                                         |
| `publishedAt`, `updatedAt`       | the first publication and the last publication that changed the content; a change of `alternates` or of Settings alone leaves `updatedAt` as it was                                                                                                                                                                                                                                                   |
| `readingMinutes`, `wordCount`    | numbers; `readingMinutes` is `wordCount` at 200 words a minute, at least 1                                                                                                                                                                                                                                                                                                                            |
| `openGraph`                      | ready values: `title`, `description`, `type` `article`, `url`, `locale`, `siteName`, `publishedTime`, `modifiedTime`                                                                                                                                                                                                                                                                                  |
| `jsonLd`                         | ready JSON-LD: `Article` with `headline`, `description`, `datePublished`, `dateModified`, `inLanguage`, `mainEntityOfPage`, the `author` as a `Person` and the `publisher` as an `Organization` with its logo as an `ImageObject`, or with no `logo` when `publisher.logo` is `null`, and the `BreadcrumbList`; no `image` and no `FAQPage`, because Google stopped showing FAQ results on 7 May 2026 |

A page has no image. Google advises against a logo or an image with text as an article's image, so neither stands in, and the template keeps its own default `og:image`. An image per page waits in the backlog. Related pages for internal linking wait in the backlog too, as a new field once they have a rule.

The template inserts `body.html`, which the guide recommends, or renders `body.markdown`, and renders `faq` and `sources` after it where it wants them, because the body holds neither. It puts `jsonLd` in `<script type="application/ld+json">`, `alternates` in `<link>` tags and `openGraph` in `<meta property>` tags. So that the JSON-LD stays true, it shows what the JSON-LD says: the H1 equal to `title`, the byline linked to `author.url`, `publishedAt`, `updatedAt` when it differs, and `breadcrumbs`. It computes nothing itself.

## Body HTML

`body.html` is semantic HTML that fits any template:

- paragraphs, `h2` to `h6`, lists, links, emphasis, quotes, tables, code and footnotes; no `h1`, because `title` is the H1 and a `#` heading in the markdown becomes an `h2`
- no class except `language-*` on a code block, and no `style`
- a link has no `rel` and no `target`; the template adds its own if it wants them
- a heading has an `id`, as github-slugger writes it from the heading's text, letters of the page's language included, so a link to `#heading` works
- the footnotes, when a page has any, end the body under a heading in the page's language, and their back links carry labels in the page's language too; Citequill has these strings for Czech, Danish, Dutch, English, Finnish, French, German, Italian, Norwegian Bokmål (`nb` and `no`), Polish, Portuguese, Slovak, Spanish, Swedish and Ukrainian, and a page in another language gets them in English
- raw HTML in the markdown is dropped, and the HTML passes a sanitizer with an allow list of elements, attributes and link schemes: the elements above, so an image or a task list's checkbox in the markdown is dropped, and the schemes `http`, `https`, `mailto` and `tel`; a relative URL and a `#fragment` pass, because internal links and footnote references need them

A template styles the body through a wrapper, the way `prose` does. A site may sanitize the HTML again on its side.

## Sitemaps

`GET /sitemap` is JSON, for a site that merges Citequill's pages into a sitemap of its own. `lastmod` is the content date, `updatedAt`.

`GET /sitemaps/{host}.xml` is a ready sitemap for one host of the project, with no key, because it holds only URLs that are public anyway. The site names it in the robots.txt of that host, `Sitemap: https://citequill.com/api/v1/sites/{siteId}/sitemaps/{host}.xml`, and Google accepts a sitemap on another host named so, without Search Console. Each host gets its own file, because a host's robots.txt vouches only for its own URLs. A `<url>` has `loc`, `lastmod` and an `xhtml:link` for every alternate, the page itself and `x-default` included, all of them live.

One XML file stays under 4 MB and under 50 000 URLs, whichever comes first, because Vercel refuses an answer over 4.5 MB. When a host's pages fit in one file, `{host}.xml` is that `urlset`. When they do not, `{host}.xml` is a sitemap index of `/sitemaps/{host}/1.xml`, `/sitemaps/{host}/2.xml` and so on. An unknown `siteId` or a host outside the project's locales gets 404.

## The guide

The documentation is public pages at `citequill.com/docs`, in English, with the guide and the reference, which Scalar renders from `openapi.json`. The reference sends no live requests, because a key belongs on a server and `v1` sends no CORS headers. Settings link to the documentation and show every example with the project's `siteId`.

The guide starts with one `curl` request. Then it gives one recipe per kind of site:

- server code that reads the API when a page is requested, with examples in Next.js, PHP and Python
- a build that reads the API, and the webhook that starts the next build through a deploy hook
- hosted builders, with what works today and what waits for the push connectors

It also says what a template shows, in the Page object section, how to answer an unpublished page, how to place the IndexNow key file, and how to verify the webhook.

## Versioning

`v1` only gains things: a field, an endpoint, an enum value, an optional parameter. A removal or a change of meaning ships in `v2`. Answers of `v1` then carry `Deprecation`, `Sunset` and `Link: <…>; rel="deprecation"` before `v1` ends.

## Webhook

A project has one webhook URL, set in Settings, Integration. It must be `https` and public, when it is saved and at every delivery. It is a secret, because a deploy hook's URL lets anyone deploy the site, so Settings mask it once it is saved and logs never hold it. A Vercel deploy hook, a Netlify build hook or a Cloudflare Pages deploy hook can be pasted in as it is.

Citequill sends one `POST` per publishing action, the way [Standard Webhooks](https://www.standardwebhooks.com/) defines it. Publishing a translation group is one action and one event.

```json
{
    "type": "page.published",
    "timestamp": "2026-10-15T06:12:00.000Z",
    "data": {
        "pages": [
            {
                "id": "…",
                "locale": "pl",
                "slug": "…",
                "path": "/pl/blog/…",
                "url": "https://example.com/pl/blog/…"
            }
        ],
        "updated": []
    }
}
```

- `type` is `page.published`, `page.updated`, `page.unpublished` or `webhook.test`. A publication sends `page.published` when a page of the action was not live before, a page published again after Unpublish included, and `page.updated` when every page of it was. Unpublish sends `page.unpublished`.
- `data.pages` lists the pages the action published, changed or unpublished: all the group's versions when the action published a group. An unpublished page adds its `redirect`, the same object as in a removal record. `data.updated` lists only the live versions outside the action whose `alternates` it changed.
- An edit in Settings of an author, the organization, a kind or a locale sends one `page.updated` with `data.pages` empty and the live pages it touches in `data.updated`. `webhook.test` has `data: { pages: [], updated: [] }`.
- The headers are `webhook-id`, the event's id, the same on every attempt and on Redeliver, so a receiver drops a duplicate; `webhook-timestamp`, in Unix seconds; and `webhook-signature`, `v1,` and the base64 HMAC-SHA256 of `id.timestamp.body`. The HMAC key is the secret's bytes, base64-decoded after `whsec_`. Each attempt and each Redeliver is signed again with its own `webhook-timestamp`; the body and `webhook-id` stay the same. A receiver refuses a timestamp more than 5 minutes off its clock, which stops a replay.
- The secret is `whsec_` and 32 random bytes in base64, shown once in Settings. Rotate the secret shows a new one, and both sign every delivery for 24 hours, so a receiver switches with no failed delivery. During a rotation `webhook-signature` holds both signatures, separated by a space: `v1,<sig1> v1,<sig2>`.
- The payload is thin: the receiver reads the page from the API.

A delivery succeeds on any 2xx within 15 seconds. Anything else fails: another status, a timeout, a lost connection, and a 3xx, which is never followed. A failed delivery is tried again after 5 seconds, 5 minutes, 30 minutes, 2 hours, 5 hours, 10 hours, 14 hours, 20 hours and 24 hours, about 3 days in all, each pause with a little jitter. A 429, 502 or 504 with `Retry-After` waits that long instead, up to 24 hours. A 410 turns the webhook off at once. When 5 days have passed since the first failed attempt with no 2xx since, the webhook turns off, and Settings say so.

While the webhook is off, no new delivery starts and its events are not kept; a sync recovers what changed. A delivery waiting between attempts reads the URL and the secrets again at each attempt, and stops when the webhook is off or the URL is empty. The owner turns the webhook back on in Settings.

Settings show the recent deliveries: the event, the attempt, the status code, the first 1 KB of the answer, the next attempt and when it was delivered. Redeliver sends one again with its event id, and Send test event sends `webhook.test`. With no URL, both are off. While the webhook is off, Send test event works and Redeliver is off.

What the site does with the webhook is its own business: a deploy hook, a revalidation, nothing. A Next.js site verifies the signature in a Route Handler and calls `revalidateTag(tag, { expire: 0 })` for the pages listed, because the `'max'` form serves the stale page once more.

## IndexNow

Citequill generates one key per project: 32 lowercase hex characters, inside IndexNow's rule of 8 to 128 letters, digits and `-`. Settings, Integration, show the file to place. It is `/<key>.txt`, holding the key, at the root of every host among the locales' base URLs. A host counts with or without `www` as the base URL has it, because to IndexNow each host is separate. A host may already serve another key file; Citequill's sits beside it.

A site that cannot upload a file to its root can proxy `/<key>.txt` to `GET /sites/{siteId}/indexnow-key.txt`, by a Next.js rewrite or a Cloudflare Worker route. The proxy must answer the file itself, not redirect to Citequill, because the check follows no redirect and no source says that engines do.

Settings show for every host whether its file answers with the key, and check it when the owner asks. When a host has no passed check, the ping fetches the key file first and pings only when it answers with the key. A switch in Settings turns the pings off, for a platform that pings by itself.

Citequill sends `POST https://api.indexnow.org/indexnow` with `{ host, key, urlList }`, one request per host, and the shared endpoint passes it to every participating engine. It pings:

- a page's URL when it goes live and was not live before, a page published again after Unpublish included
- a page's URL when a change is published and its rendered body changed
- a page's old URL when it is unpublished, because engines want to know a URL answers 410 or redirects

It never pings a change of `alternates` alone, an edit in Settings, or the back catalogue. When a URL was pinged less than 10 minutes ago, the ping waits until 10 minutes after that ping, then sends, so a change is deferred and never dropped. IndexNow publishes no limit, but each engine sets its own per site, Yandex asks for 10 minutes between two submissions of one URL, and every source asks for changed URLs only.

A 200 or a 202 is a success. A 403 means the key file failed: Citequill clears the host's check and Settings say so. A 422 is logged as a fault of ours. A 429 waits for `Retry-After`, or 10 minutes. Google does not read IndexNow; there the sitemap does the work.

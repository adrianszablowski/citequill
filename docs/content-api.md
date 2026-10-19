# Content API

The customer's site reads published pages from here. The API assumes only that the customer can send an HTTP request and insert HTML or markdown; all the SEO and GEO logic is on our side. Base URL: `https://citequill.com/api/v1`.

## Authentication

Header `Authorization: Bearer <site key>`. The key is per project, shown once in Settings, stored as a hash. Without the header or with a wrong key: 401. The API returns only `published` pages, so drafts do not leak.

## Endpoints

| Method and path              | Returns                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /pages`                 | list of pages, filters `locale`, `kind`, `updatedSince` (ISO 8601), pagination `cursor` and `limit` (default 50, at most 200); response `{ pages, nextCursor }` |
| `GET /pages/{locale}/{slug}` | one page, 404 when it does not exist or is not `published`                                                                                                      |
| `GET /redirects`             | list of `{ from, to, status }`, where `from` is the full path, `to` a URL or `null`, `status` 301 or 410                                                        |
| `GET /sitemap`               | list of `{ url, lastmod, alternates: [{ locale, url }] }` for `published` pages                                                                                 |

Every response has `ETag` and `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`; `If-None-Match` gives 304. A customer without a webhook polls the API and relies on these headers.

## Page object

| Field                      | Content                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | identifier                                                                                                                                                             |
| `kind`                     | name of the kind from the project                                                                                                                                      |
| `locale`                   | locale                                                                                                                                                                 |
| `slug`                     | last segment of the URL                                                                                                                                                |
| `path`                     | full path on the customer's site, from the locale's base URL                                                                                                           |
| `url`                      | full URL                                                                                                                                                               |
| `translations`             | list of `{ locale, slug, url }` of other language versions, for hreflang                                                                                               |
| `title`                    | H1                                                                                                                                                                     |
| `metaTitle`                | `<title>`                                                                                                                                                              |
| `metaDescription`          | meta description                                                                                                                                                       |
| `canonical`                | the same as `url`                                                                                                                                                      |
| `excerpt`                  | one paragraph for lists and Open Graph                                                                                                                                 |
| `body`                     | `{ markdown, html }`, both from the same source                                                                                                                        |
| `faq`                      | list of `{ question, answer }`                                                                                                                                         |
| `author`                   | `{ name, title, url }`                                                                                                                                                 |
| `publishedAt`, `updatedAt` | ISO 8601                                                                                                                                                               |
| `readingMinutes`           | number                                                                                                                                                                 |
| `tags`                     | list                                                                                                                                                                   |
| `sources`                  | list of `{ title, url }` from the research                                                                                                                             |
| `related`                  | list of `{ title, url }` of Citequill pages in this locale, for internal linking                                                                                       |
| `jsonLd`                   | ready JSON-LD: `Article` and `BreadcrumbList`, author and organisation from the project fields; no `FAQPage`, because Google stopped showing FAQ results on 7 May 2026 |

The customer inserts `body.html` or renders `body.markdown`, renders `faq` and `sources` after it where the template wants them, because the body holds neither, puts `jsonLd` in `<script type="application/ld+json">` and builds `<link rel="alternate" hreflang>` from `translations`. They do not have to compute anything themselves.

## Webhook

When a project has a webhook URL, Citequill sends a `POST` after every publication, update and unpublishing:

```json
{
    "event": "published",
    "pageId": "…",
    "locale": "pl",
    "slug": "…",
    "path": "/pl/blog/…",
    "url": "https://example.com/pl/blog/…",
    "occurredAt": "2026-10-15T06:12:00Z"
}
```

`event` is `published`, `updated` or `unpublished`. Header `Citequill-Signature: sha256=<HMAC-SHA256 of the body with the webhook secret>`; the secret is shown once in Settings. A response other than 2xx repeats the delivery 3 times with a growing delay. What the customer does with the webhook is their business: revalidation, a deploy hook, nothing.

## IndexNow

Citequill generates a key per project and shows in Settings which file to place at `https://<domain>/<key>.txt`. Before every ping Citequill fetches this file; when it responds with the key, Citequill sends the page URL to `api.indexnow.org`. When it does not respond, there is no ping and Settings show that the file was not found. Google does not read IndexNow; there the customer's sitemap does the work.

## Redirects

The list from `GET /redirects` is the `unpublished` pages. The customer answers `from` with the `status` code: 301 to `to`, or 410. A page from this list is not in `GET /pages` or in `GET /sitemap`.

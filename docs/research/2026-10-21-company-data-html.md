# Page HTML, company data and the logo: research fetched on 21 October 2026

Every web source below was fetched on 21 October 2026. Local sources are the installed packages of this repo (Next.js 16.4.0, `@supabase/storage-js` 2.118.0, the unified packages listed in section 1) and a probe script run against them from `/tmp/citequill-probe/`, outside the repo. Facts already in [`2026-10-19-structured-data.md`](2026-10-19-structured-data.md) are cited, not repeated.

## Summary

1. Supabase Storage serves every object with `X-Robots-Tag: none` by default, and Google defines `none` as `noindex, nofollow`. Google wants an Organization logo URL that is crawlable and indexable. A logo or page image uploaded to Supabase is not indexable as served, unless the upload sets its own `x-robots-tag` header (section 4).
2. Google tells sites to avoid a generic image, such as the site logo, and an image with text, as a page's preferred image, in both its Google Images and Discover guides. The logo fallback and a generated title card both go against that advice, so the recommendation is no page image in step 5 (section 5).
3. In production, Next.js 16.4's `ImageResponse` sends `Cache-Control: public, max-age=0, must-revalidate`, which replaces the year-long immutable header that `@vercel/og` sets by itself. A per-page image route renders again on every request unless its code sets the header (section 5).
4. The renderer drops raw HTML and `javascript:` links, as `docs/decisions.md` says. 4 outputs do not fit HTML that any template embeds: GFM footnotes add an English "Footnotes" heading with the class `sr-only` and ids prefixed `user-content-`, a `#` heading becomes a second `h1`, `tel:` links lose their address, and heading ids keep Polish letters (section 1).
5. Google recommends Organization markup on the home page or an about page, and lists no properties for an Article's `publisher`. A Citequill page needs a publisher with a name, URL and logo. Address, VAT number and the other 26 properties belong in the site's own home page markup (section 2).
6. Google asks for an author's `url` or `sameAs`, and the job title in `jobTitle`, never in the name. The `authors` table has no `sameAs` today (section 2).
7. The crawl's signals drop `ImageObject` nodes, so a Yoast site's logo, which is a reference by `@id` to an `ImageObject`, never reaches a prefill. The audit's `structuredData()` already resolves `@id` references, and `describesSite()` already finds the site's own node (section 3).
8. Supabase checks the declared MIME type of an upload, not its bytes. It serves the stored type with no `Content-Security-Policy` and no `X-Content-Type-Options`. An SVG runs its scripts when opened directly. The logo bucket should take PNG, JPEG and WebP only (section 4).
9. The dashboard can show the logo with `next/image` and `unoptimized`, as the audit's thumbnails already do. That needs no `remotePatterns` and uses none of the 5,000 image transformations a month that Hobby includes (section 4).
10. Google needs no `rel` on an editorial link, `rehype-external-links` adds `nofollow` by default, and WCAG advises warning people before a link opens a new window. The HTML should carry neither `rel` nor `target` (section 1).

## 1. The page HTML

`renderMarkdown()` in `features/pages/render.ts` runs unified with remark-parse, remark-gfm 4.0.1, remark-rehype 11.1.2 (mdast-util-to-hast 13.2.1), rehype-slug 6.0.0 (github-slugger 2.0.0), rehype-sanitize 6.0.0 (hast-util-sanitize 5.0.2) with GitHub's schema and `clobberPrefix: ''`, then rehype-stringify 10.0.1. The probe ran that exact pipeline on test markdown. Raw HTML never reaches the tree, because remark-rehype drops it unless `allowDangerousHtml` is set. The sanitiser then removes any address outside its protocol list.

Most of the output is plain elements with no classes. 4 things break the goal of HTML that works in any template:

- footnotes bring an English label, a class and prefixed ids
- an `h1` in the markdown becomes a second `h1` beside the template's title
- a `tel:` link loses its `href`
- ids keep non-ASCII letters, which works but differs from the ASCII page slug

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Raw HTML in markdown | `<b onclick>`, `<img onerror>`, `<iframe>`, `<details>` and `<span style>` all dropped, their text kept | probe of the installed pipeline | yes, installed code |
| Script and unknown addresses | `javascript:`, `JaVaScRiPt:`, an entity-encoded `&#106;avascript:`, `data:`, `vbscript:` and `tel:` all give `<a>` with no `href`; `mailto:`, `/path`, `#frag` and `https:` kept | probe | yes, installed code |
| Default `protocols` | `href`: http, https, irc, ircs, mailto, xmpp; `src`: http, https | `defaultSchema` printed by the probe | yes, installed code |
| Default `strip` and `clobber` | `strip`: `script`; `clobber`: ariaDescribedBy, ariaLabelledBy, id, name; default prefix `user-content-` | `defaultSchema` printed by the probe | yes, installed code |
| Unknown elements | "replaced by what they contain"; `strip` drops their content instead | https://github.com/syntax-tree/hast-util-sanitize | yes |
| Order | "Use `hast-util-sanitize` after the last unsafe thing" | https://github.com/syntax-tree/hast-util-sanitize | yes |
| Why the prefix exists | the plugin "solves the clobbering by prefixing every `id` and `name`" with `user-content-` | https://github.com/rehypejs/rehype-sanitize | yes |
| Ids become globals | elements with an `id` are reachable "as global properties of the window object" | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/id | no, MDN |
| Slug algorithm | GitHub's: lowercase, spaces to hyphens, non-Latin letters kept, emoji removed; repeats get `-1`, `-2` | https://github.com/Flet/github-slugger | yes |
| Polish heading | `## Ile białka zjeść? Łódź, żółć, Ślęża` gives `id="ile-białka-zjeść-łódź-żółć-ślęża"`, the second copy `…-ślęża-1` | probe | yes, installed code |
| Emoji and symbols | `## 10 tips 🚀 for 2026: A/B tests & more` gives `id="10-tips--for-2026-ab-tests--more"`: digits kept, double hyphens where the emoji and `&` stood | probe | yes, installed code |
| A non-ASCII fragment resolves | the browser looks for the id as written, then percent-decodes the fragment, decodes it as UTF-8 and looks again | https://html.spec.whatwg.org/multipage/browsing-the-web.html#select-the-indicated-part | yes |
| Id rules | unique in the document, no ASCII whitespace, "may contain any other Unicode character"; ids that are not CSS identifiers need escaping in selectors | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/id | no, MDN |
| Footnotes | `[^1]` gives `<section data-footnotes class="footnotes"><h2 class="sr-only" id="footnote-label">Footnotes</h2>`, ids `user-content-fn-1` and `user-content-fnref-1`, and `aria-label="Back to reference 1"` | probe | yes, installed code |
| Footnote defaults | `footnoteLabel` "Footnotes", `footnoteLabelProperties` `{className: ['sr-only']}`, `clobberPrefix` `user-content-` for footnote ids; "When your page is not in English, you must define translated values." | https://github.com/remarkjs/remark-rehype | yes |
| Other classes | `language-js` on fenced code, `contains-task-list` and `task-list-item` on task lists, `align="left"` on aligned table cells | probe | yes, installed code |
| `h1` | `# Title` gives `<h1 id="title">` | probe | yes, installed code |
| Links | no `rel`, no `target` on any link | probe | yes, installed code |

### Sanitisers compared

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| rehype-sanitize | works on the hast tree with no DOM; "drops anything that isn't explicitly allowed by a schema"; GitHub's schema by default | https://github.com/rehypejs/rehype-sanitize | yes |
| sanitize-html | "Built on htmlparser2", string in and string out; default `a` attributes `href`, `name`, `target`; `disallowedTagsMode` `discard` by default; allowing `script` or `style` "leaves you open to XSS attacks" | https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html | yes |
| sanitize-html repository | the old repository is archived in favour of the Apostrophe monorepo; its README lists `tel` among default schemes in one place and leaves it out in another | https://github.com/apostrophecms/sanitize-html | yes |
| DOMPurify | "DOM-only"; on Node it needs jsdom, and the README "strongly recommend[s]" the latest version; happy-dom is "not considered safe"; HTML, SVG and MathML allowed by default; default protocols include `tel`; version 3.4.16 | https://github.com/cure53/DOMPurify | yes |
| OWASP's choice | "OWASP recommends DOMPurify for HTML Sanitization." | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html | yes |
| Changing HTML after sanitising | "If you sanitize content and then modify it afterwards, you can easily void your security efforts." | same OWASP page | yes |
| URLs | "Allow-list http and HTTPS URLs only" | same OWASP page | yes |
| Embedding | React's `dangerouslySetInnerHTML` "without sanitizing the HTML" is named as a gap; CSP is "an additional layer of defense", not the primary one | same OWASP page | yes |

### Classes, the `h1`, `rel` and `target`

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| One `h1` | multiple `h1` elements are allowed but "not considered a best practice"; "Prefer using only one `<h1>` per page" | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/Heading_Elements | no, MDN |
| Heading order and Google | "from Google Search perspective, it doesn't matter if you're using them out of order" | https://developers.google.com/search/docs/fundamentals/seo-starter-guide | yes |
| Editorial links | for regular links "you don't need to add a `rel` attribute"; `sponsored` for paid, `ugc` for user content, `nofollow` "when other values don't apply" | https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links (updated 10 December 2025) | yes |
| Untrusted links | add "a nofollow or similar annotation" to a link you cannot trust | https://developers.google.com/search/docs/fundamentals/seo-starter-guide | yes |
| `target="_blank"` | it "implicitly provides the same `rel` behavior as setting `rel="noopener"`" | https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener | no, MDN |
| New windows and access | WCAG G201 asks for "advanced warning for links and buttons that open a new window or tab" | https://www.w3.org/WAI/WCAG22/Techniques/general/G201 | yes |
| `rehype-external-links` defaults | `rel` `['nofollow']`; no `target` by default | https://github.com/rehypejs/rehype-external-links | yes |
| How templates style foreign HTML | the `prose` class on a wrapper styles "any vanilla HTML you don't control", such as HTML from Markdown or a CMS | https://github.com/tailwindlabs/tailwindcss-typography | yes |

## 2. Company and author data

Google's Organization page was last updated on 8 September 2026, the same date as on 19 October. It still has no required properties and 30 recommended ones, as section 15 of the earlier file lists. The new facts below are the rules attached to each property and where Google wants the markup.

Google lists no properties for an Article's `publisher`. It names `publisher` only to say that the publisher's name does not go in `author.name`.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Where Organization markup goes | "We recommend placing this information on your home page, or a single page that describes your organization" | https://developers.google.com/search/docs/appearance/structured-data/organization | yes |
| What it does | can affect "which `logo` is shown in Search results" | same page | yes |
| `name` | "Use the same `name` and `alternateName` that you're using for your site name." | same page | yes |
| `legalName` | only "if applicable and different from the `name` property" | same page | yes |
| `telephone`, `contactPoint.telephone` | include the country code and area code | same page | yes |
| `taxID` | must match the country given in `address` | same page | yes |
| `duns` | Google recommends `iso6523Code` with the prefix `0060:` instead | same page | yes |
| `sameAs` | a page on another site about the organisation; multiple URLs allowed | same page | yes |
| Logo rules | unchanged: 112 by 112 px minimum, crawlable and indexable, a Google Images format, readable on white | [`2026-10-19-structured-data.md`](2026-10-19-structured-data.md), section 15 | see that file |
| Site name source | `WebSite` markup on the home page, then `og:site_name`, `<title>` and headings; no site names for subdirectories | https://developers.google.com/search/docs/appearance/site-names (updated 10 December 2025) | yes |
| schema.org version | 30.1, 16 September 2026 | https://schema.org/Organization | yes |
| Properties schema.org has and Google does not list | `founder`, `areaServed`, `brand`, `knowsAbout`, `parentOrganization`, `subOrganization`, `image` | https://schema.org/Organization | yes |
| `sameAs` on schema.org | "URL of a reference Web page that unambiguously indicates the item's identity" | https://schema.org/Organization | yes |
| `address`, `contactPoint` types | `PostalAddress` or Text; `ContactPoint` | https://schema.org/Organization | yes |
| `publisher` | range Organization or Person; used on CreativeWork | https://schema.org/publisher | yes |
| Google and `publisher` | not among the 7 recommended Article properties; its one fragment is an Organization with `name` and `url`, no `logo` | https://developers.google.com/search/docs/appearance/structured-data/article (updated 8 September 2026) | yes |
| Author type | `Person` for people, `Organization` for organisations, never `Thing` | same Article page | yes |
| Author identity | "we strongly recommend using the `type` and `url` (or `sameAs`) properties"; "Use valid URLs for the `url` or `sameAs` properties" | same Article page | yes |
| Author name | only the name: no publisher, no job title, no honorific, no "posted by"; the job title goes in `jobTitle` | same Article page | yes |
| All authors | every author shown on the page is in the markup, each in its own `author` field | same Article page | yes |
| Author image | the Article page does not mention one | same Article page | yes |
| Person types | `jobTitle` DefinedTerm or Text; `image` ImageObject or URL; `sameAs` URL; `worksFor` Organization | https://schema.org/Person | yes |
| Profile page markup | holds `image` and `sameAs` for a person; unchanged | [`2026-10-19-structured-data.md`](2026-10-19-structured-data.md), section 17 | see that file |
| What the skills hold | What it is holds the legal name, founding year, location and who runs the company, in prose; authors and the organisation are project fields | `docs/skills.md`, lines 37 and 48 | yes, repo |
| What the data model holds | `projects`: `organization_name`, `organization_url`, `organization_logo_url`; `authors`: `name`, `title`, `url` | `docs/data-model.md`, lines 12 and 14 | yes, repo |
| What the database holds | neither the three `organization_*` columns nor any logo column exists yet; `authors` has `name`, `title`, `url` | `lib/types/database.ts` | yes, repo |

## 3. Prefilling company data

The crawl already stores signals for each page it reads. It keeps JSON-LD nodes of 19 types, but `ImageObject` is not one of them. Yoast, the WordPress plugin, writes the Organization's `logo` as a reference by `@id` to an `ImageObject` node. On a Yoast site, the crawl therefore keeps the reference and drops the image it points to.

The audit reads JSON-LD more completely than the crawl. `structuredData()` indexes every node by `@id` and merges a reference with its node. `describesSite()` matches a node whose `url` or `@id` is a home page, or whose name is the site's name. `jsonLdImages()` reads the `url` and `contentUrl` of an `ImageObject`.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| What the crawl keeps | description, site name (an Organization-like JSON-LD `name`, else `og:site_name`), `og:title`, `og:description`, canonical, JSON-LD of 19 types up to 6,000 characters, `mailto:` and `tel:` addresses, links to 22 social hosts, the first 1,500 characters of `footer` | `features/crawl/signals.ts` | yes, repo |
| What it does not keep | `og:image`, the JSON-LD `logo`'s `ImageObject`, `<link rel="icon">` and `apple-touch-icon` | `features/crawl/signals.ts` | yes, repo |
| Author on a crawled page | `meta name="author"`, else the first JSON-LD `author` name | `features/crawl/html.ts`, `readPage()` | yes, repo |
| Author pages | the Rank step drops author archives | `docs/workflow.md`, line 24 | yes, repo |
| The audit's reader | `structuredData()`, `valuesAt()`, `describesSite()`, `jsonLdImages()` | `features/audit/structured-data.ts` | yes, repo |
| JSON-LD on the web | on 41% of pages in 2024; a chart gives 37% for desktop | https://almanac.httparchive.org/en/2024/structured-data | yes, HTTP Archive's own crawl |
| Most common types | `WebSite` 12.73%, `Organization` 7.16%, `BreadcrumbList` 5.66%, `LocalBusiness` 3.97% of mobile pages; `Person` not reported | same chapter | yes |
| `sameAs` targets | Facebook 4.53%, Instagram 3.67%, LinkedIn 1.11%, Wikidata 0.17% | same chapter | yes |
| `og:image` | about 48% of desktop pages; `og:image:alt` 5.78% of mobile pages | same chapter | yes |
| Yoast Organization | required `@type`, `@id`, `name`, `url`, `logo`; optional `sameAs`, `image`, `alternateName`; output "on all public pages"; `@id` is the home URL plus `#/schema/Organization/{{ID}}` | https://developer.yoast.com/features/schema/pieces/organization/ | yes |
| Yoast Person | required `name`; optional `description` (bio cut at 250 characters), `sameAs`, `image`, `url`; `@id` is the home URL plus `#/schema/Person/{{ID}}` | https://developer.yoast.com/features/schema/pieces/person/ | yes |
| Yoast Article | `author` and `publisher` both required, each a reference by `@id` | https://developer.yoast.com/features/schema/pieces/article/ | yes |
| Shopify's Dawn theme | the header writes an Organization with `name`, `logo` (the theme logo at 500 px wide, only when set), a `sameAs` list of 9 social settings, and `url`; there is no `@id` | https://github.com/Shopify/dawn/blob/main/sections/header.liquid | yes |
| Open Graph | `og:site_name` is "the name which should be displayed for the overall site"; the spec has no `og:logo` | https://ogp.me/ | yes |
| Footer data in the EU | the e-Commerce Directive, Article 5(1), requires the provider's name, geographic address, email, trade register and number, and VAT number where VAT applies, to be easy to reach | https://lawplayer.com/eu/act/32000L0031 | no, a reproduction of EUR-Lex |

## 4. The logo

Google's logo rules have not changed since 19 October. The new facts are about where the file lives. Supabase serves every object with `X-Robots-Tag: none` unless the upload sets a value of its own. This went live on 12 November 2025. 3 public objects on 3 unrelated hosted projects, found through GitHub code search, all answered with it today.

Supabase also serves the declared type as stored. It sends no `Content-Security-Policy`, no `X-Content-Type-Options` and no `Content-Disposition` unless `?download` is added. Browsers disable scripts in an SVG only when it is used as an image. An SVG opened directly runs its scripts.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Google Images formats | BMP, GIF, JPEG, PNG, WebP, SVG and AVIF | https://developers.google.com/search/docs/appearance/google-images (updated 2 March 2026) | yes |
| Favicon rules | square, at least 8 by 8 px, larger than 48 by 48 px recommended; BMP, GIF, ICO, PNG, JPEG, PPM, TIFF; a stable URL that Googlebot-Image can crawl; `icon`, `shortcut icon`, `apple-touch-icon` read | https://developers.google.com/search/docs/appearance/favicon-in-search (updated 28 August 2026) | yes |
| `none` | "Equivalent to `noindex, nofollow`"; `noindex` covers "this page, media, or resource"; `X-Robots-Tag` is the way to mark image files | https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag (updated 24 March 2026) | yes |
| Supabase default header | `X-Robots-Tag: none` on every served object; a valid value stored on the object replaces it | https://github.com/supabase/storage/blob/master/src/storage/renderer/renderer.ts | yes |
| Where the override comes from | the `x-robots-tag` request header of the upload; PR #776, merged 12 November 2025, added the default and "ability to specify custom `x-robots-tag` header when uploading objects" | https://github.com/supabase/storage/blob/master/src/storage/uploader.ts, https://github.com/supabase/storage/pull/776 | yes |
| SDK support | `upload()` takes a `headers` option; `cacheControl` defaults to 3,600 seconds | `@supabase/storage-js` 2.118.0, `dist/index.d.mts` | yes, installed code |
| Live headers | `x-robots-tag: none`, `cache-control: public, max-age=3600`, `access-control-allow-origin: *`; no CSP, no `x-content-type-options`, no `content-disposition`; `?download` adds `content-disposition: attachment;`; the project host's `robots.txt` answers 404 | curl of 3 public objects | yes, the live service |
| Served type | the stored MIME type, except that `text/html` is served as `text/plain` | `renderer.ts`, `normalizeContentType()` | yes |
| Upload type check | the declared type, from the form's `contentType` field or the `Content-Type` header, is compared with the bucket's list; the bytes are not checked | https://github.com/supabase/storage/blob/master/src/storage/uploader.ts | yes |
| Public bucket | reads skip access control, while uploads, deletes, moves and copies are still checked; "more performant than private buckets"; profile pictures are a listed use | https://supabase.com/docs/guides/storage/buckets/fundamentals | yes |
| Signed URLs | valid until expiry "regardless of any Auth key changes"; revoking one needs Supabase support | https://supabase.com/docs/guides/storage/serving/downloads | yes |
| Per-bucket limits | `public` (default false), `fileSizeLimit`, `allowedMimeTypes`, with wildcards such as `image/*` | https://supabase.com/docs/guides/storage/buckets/creating-buckets | yes |
| Global size limit | at most 50 MB on Free, up to 500 GB on Pro; a bucket's limit cannot exceed it | https://supabase.com/docs/guides/storage/uploads/file-limits | yes |
| RLS | no uploads without policies on `storage.objects`; an upload needs `INSERT`, an upsert also `SELECT` and `UPDATE`; folders through `storage.foldername(name)`; service keys bypass RLS | https://supabase.com/docs/guides/storage/security/access-control | yes |
| Image transformations | Pro plan and above; $5 per 1,000 origin images after 100 included; 1 to 2,500 px; 25 MB and 50 MP at most; SVG accepted | https://supabase.com/docs/guides/storage/serving/image-transformations | yes |
| Admin client rule | `createAdminClient()` is for writes with no user session, "never in a route a user calls" | `.claude/rules/orthogonality.md` | yes, repo |
| Server Action body | capped at 1 MB by default | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` | yes, installed docs |
| SVG as an image | in an image context "JavaScript is disabled"; the restrictions do not apply when the SVG is viewed directly or embedded with `iframe`, `object` or `embed` | https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image | no, MDN |
| `Content-Disposition` | `inline` shows the file, `attachment` downloads it | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition | no, MDN |
| `nosniff` | stops a browser treating a response as `text/html` when its declared type is not HTML | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options | no, MDN |
| Upload checks | the Content-Type "cannot be trusted"; check file signatures together with the type; set size limits; "decode and re-encode" images; store files on a different host | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html | yes |
| `next/image` and remote URLs | an absolute external URL "must be configured with remotePatterns"; `unoptimized` serves the `src` as is | `node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md` | yes, installed docs |
| Where the check lives | the `remotePatterns` error is thrown by the default loader, which `unoptimized` never calls | `node_modules/next/dist/shared/lib/image-loader.js` line 81, `get-img-props.js` line 95 | yes, installed code |
| SVG in `next/image` | a `src` ending in `.svg` is served unoptimised; `dangerouslyAllowSVG` should come with `contentDispositionType: 'attachment'` and a CSP | same `image.md` | yes, installed docs |
| Next.js 16 image defaults | `qualities` `[75]`, `minimumCacheTTL` 4 hours, `maximumRedirects` 3, and a redirect is not checked against `remotePatterns` again | same `image.md` and `02-guides/upgrading/version-16.md` | yes, installed docs |
| Vercel image usage on Hobby | 5,000 transformations, 300,000 cache reads and 100,000 cache writes a month; past the limit new images answer 402 | https://vercel.com/docs/image-optimization/limits-and-pricing (updated 11 August 2026) | yes |
| Formats Vercel optimises | JPEG, PNG, WebP and AVIF; other formats are served as is | same page | yes |
| Dashboard slot | the project switcher's logo slot is `size-8` (32 px square, `rounded-lg`), showing a Feather icon today | `features/projects/components/project-switcher.tsx` | yes, repo |
| Pattern in the repo | `ImageThumbnail` uses `next/image` with `unoptimized`, a fixed size, `alt=""` and `referrerPolicy="no-referrer"` | `features/audit/components/image-thumbnail.tsx`, `docs/decisions.md` line 545 | yes, repo |

## 5. The page image

Citequill pages have no image: `pages` has no image column and the Content API has no image field. Google recommends an Article `image` but does not require one. The earlier file records that Google wants an image "relevant to the article, rather than logos", and Google's own wording is unchanged today.

Two more Google guides now say the same thing about the preferred image, and both name `og:image`. That leaves 3 options: the logo, a generated card or no image.

| Fact | Value | Source | Primary? |
| --- | --- | --- | --- |
| Article image | recommended, not required; 50,000 px and the 16x9, 4x3, 1x1 ratios; relevant to the article, not a logo | [`2026-10-19-structured-data.md`](2026-10-19-structured-data.md), section 1, wording unchanged on the page today | see that file |
| Preferred image sources | `primaryImageOfPage`, the main entity's `image`, or `og:image`; the choice is automated | https://developers.google.com/search/docs/appearance/google-images | yes |
| What to avoid | "Avoid using a generic image (for example, your site logo)" "or an image with text in the schema.org markup or `og:image` `meta` tag"; avoid extreme aspect ratios | same page | yes |
| Discover | at least 1,200 px wide, over 300,000 px, 16x9, with `max-image-preview:large`; "Avoid using generic images (for example, your site logo)"; "avoid using text-heavy images" | https://developers.google.com/search/docs/appearance/google-discover (updated 9 March 2026) | yes |
| Open Graph | `og:image` is one of the 4 required properties; a page with `og:image` "should specify `og:image:alt`" | https://ogp.me/ | yes |
| Facebook | at least 1,200 by 630 px, close to 1.91:1, 200 by 200 px minimum, 8 MB at most | https://developers.facebook.com/docs/sharing/webmasters/images | yes |
| `ImageResponse` | 1,200 by 630 px by default; Satori and Resvg render to PNG; flexbox and a subset of CSS only; 500 KB bundle at most; `ttf`, `otf` or `woff` fonts | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md` | yes, installed docs |
| Cache header in production | Next.js sets `public, max-age=0, must-revalidate` unless `options.headers` replaces it | `node_modules/next/dist/server/og/image-response.js` | yes, installed code |
| `@vercel/og`'s own header | `public, immutable, no-transform, max-age=31536000`, which the Next.js wrapper does not pass on | `node_modules/next/dist/compiled/@vercel/og/index.node.js` (1.0.1) | yes, installed code |
| Vercel's claim | `@vercel/og` "automatically adds the correct headers to cache computed images on the CDN"; allow the image route in `robots.txt`; Node.js runtime | https://vercel.com/docs/og-image-generation (updated 16 June 2026) | yes |
| Runtime under Cache Components | App Router edge routes are rejected at compile time under Cache Components, so the route runs on Node.js | comment in `node_modules/next/dist/server/og/image-response.js` | yes, installed code |
| File convention | `opengraph-image` is cached by default unless it uses a request-time API; in Next.js 16 its `params` is a Promise | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`, `02-guides/upgrading/version-16.md` | yes, installed docs |
| Default font | Geist Regular ships with `next/og` and covers all 18 Polish letters, ą to Ż | `fc-query` of `node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf` | yes, installed code |
| Hobby function usage | 1,000,000 invocations, 4 CPU-hours of Active CPU, 360 GB-hours a month; "non-commercial, personal use only" | https://vercel.com/docs/plans/hobby (updated 14 September 2026) | yes |

## Design implications for Citequill

### The HTML contract

This touches `docs/content-api.md` line 36 (`body`) and line 46, `docs/workflow.md` line 68 (Publishing, step 1) and `docs/decisions.md` line 276.

Options:

- Keep the pipeline as it is. This is the least code, but the footnote label stays English with a class the customer may not have, and a stray `#` gives a second `h1` (section 1).
- Make 3 small changes before `rehype-sanitize`. These are: footnote labels in the page's language with `clobberPrefix: ''`, or no footnotes at all, because `sources` already carries citations; `h1` turned into `h2`; and `tel` added to `protocols.href` if the writer may link a phone number. Each transform runs before the sanitiser, as OWASP and hast-util-sanitize ask (section 1).
- Switch to DOMPurify. It needs jsdom on the server and gains nothing, because the HTML starts as markdown that unified already parses into a tree.

Recommendation: the second option. `content-api.md` should then state the contract: the elements the HTML can hold, no classes except `language-*` on code, no `h1`, no `rel` and no `target`, and raw HTML dropped. It should also say that a template styles the HTML through a wrapper, the way `prose` does, and that a customer may sanitise again on their side.

### Link attributes

This touches `docs/content-api.md` line 46. Google needs no `rel` on an editorial link, a `target` without a warning goes against WCAG G201, and `rehype-external-links` would add `nofollow` by default (section 1). Recommendation: no `rel` and no `target`. The template adds its own if it wants them.

### Heading ids

This touches `docs/decisions.md` line 276 and the comment in `features/pages/render.ts`, which both say "letters and hyphens". The ids also hold digits, non-ASCII letters and double hyphens (section 1).

Options:

- Keep github-slugger. Ids look like GitHub's, and browsers resolve a percent-encoded fragment (section 1).
- Transliterate to ASCII, so ids match the ASCII page slug that `features/pages/prompts.ts` asks for. This needs a custom slugger and its tests.
- Bring the `user-content-` prefix back. This stops DOM clobbering, but `#heading` links then need a script on the customer's site.

Recommendation: keep github-slugger and correct the decision's wording. Record the clobbering risk as accepted. Because slugs are lowercase, only a lowercase global with no hyphen, such as `analytics`, can be shadowed. That limit is an inference from the slug rules, not a tested fact.

### Company data fields

This touches `docs/data-model.md` line 12, `docs/product.md` line 37 and `docs/skills.md` line 48.

Options:

- A small set: `name`, `url`, `logo` and `sameAs`.
- Google's full 30 properties.

The full set fits the home or about page where Google wants Organization markup, but Citequill writes neither. It would also duplicate the legal name, founding year and location that What it is already holds in prose, and two copies drift (section 2).

Recommendation: the small set, which means adding `organization_same_as`. `name` defaults to the project's name, because Google wants the Organization `name` to equal the site name. `url` defaults to the origin of the default locale's base URL.

### Author fields

This touches `docs/data-model.md` line 14, `docs/product.md` line 36 and `docs/content-api.md` line 38. Google asks for `url` or `sameAs` and a separate `jobTitle`, and its Article page does not mention an author image (section 2).

Recommendation: add `same_as`, a list, to `authors`. Map `title` to `jobTitle` in the JSON-LD. Leave the author image for later.

### The publisher in `jsonLd`

This touches `docs/content-api.md` line 44.

Recommendation: write `publisher` as an `Organization` with `name`, `url` and `logo`, and give the logo as an `ImageObject` with its real `width` and `height`. Citequill's own audit flags a declared logo under 112 px (`jsonld-logo-small`) and a logo that does not answer 200 (`jsonld-image-unreachable`).

When the prefill finds the site's own Organization `@id`, the publisher should reuse it. Yoast and Dawn already write an Organization on every page, and a second unrelated node describes the same company twice. Whether Google merges two nodes with the same `@id` across separate script blocks is not confirmed.

### The prefill

This touches `docs/workflow.md` line 25 (the signals) and line 29 (step 7).

Recommendation: run the audit's `structuredData()` over the home page's JSON-LD blocks and take the top node that `describesSite()` accepts. Read its `name`, `url`, `logo` (`url` or `contentUrl`) and `sameAs`. Fall back to `og:site_name` and the project's name for the name, and to the crawl's social links for `sameAs`.

Settings should show every prefilled value as found on the site, for the owner to confirm. For authors, take the Person behind `author` on the posts the crawl read, with its `url`, `sameAs` and `jobTitle`, because the Rank step skips author archives. Footer facts such as the legal name, address and VAT number stay in What it is (section 3).

This needs the crawl to keep `ImageObject` nodes, or to hand the raw blocks of the home page to the audit's reader. Otherwise a Yoast logo is lost.

### Where the logo lives

This touches `docs/data-model.md` line 12 (`organization_logo_url`) and `docs/product.md` line 37.

Options:

- A URL on the customer's site, prefilled from their markup. It is already crawlable where the site hosts it, needs no upload code and carries no SVG risk for us. It breaks if the site moves the file.
- An upload to a public Supabase bucket. The URL is stable, but by default it is served as `noindex`. The upload must set `x-robots-tag: all`, which the source supports but nobody has tested on the hosted service. The bucket allows `image/png`, `image/jpeg` and `image/webp`, and the action checks the file signature, because Supabase checks only the declared type. The size limit is 1 MB, the Server Action default. The path is `<project_id>/<content hash>.<ext>` with a long `cacheControl`. Because the admin client is not for a route a user calls, uploads need an `INSERT` policy on `storage.objects` scoped to the owner's project folder (section 4).
- A private bucket with signed URLs. A signed URL expires and cannot be revoked without support, which is wrong for a URL written into JSON-LD and an API response.
- A proxy through citequill.com. Any SVG would then run on the origin that holds the session cookies, and every view costs a function call.

Recommendation: the customer's URL first, with the upload as a fallback, and never SVG.

### The dashboard logo

This touches `docs/product.md` line 54.

Recommendation: `next/image` with `unoptimized` in the 32 px slot, `object-contain`, `alt=""`, `referrerPolicy="no-referrer"`, and the Feather icon when there is no logo. This copies `ImageThumbnail`, needs no `remotePatterns` and uses no Vercel transformations (section 4).

A wide logo will look small in a square slot. A square icon from `apple-touch-icon` could fill it, but that is a second field, so it waits.

### The page image

This touches the page object table in `docs/content-api.md` and `docs/data-model.md` line 50.

Options:

- The logo as a fallback. Google says avoid it in 3 places.
- A generated card from `ImageResponse`. It is text on an image, which Google Images and Discover both advise against. It also renders on every request unless the route sets `Cache-Control`, it runs on Node.js only under Cache Components, and it is served from citequill.com, so `robots.txt` must allow it. Rendering it once at publishing and storing it removes the per-request cost, but brings back Supabase's `noindex` default.
- No image. Google does not require one. The customer's template keeps its own default `og:image`.

Recommendation: no image in step 5. `jsonLd` has no `image` and the API sends no `og:image`. Add a backlog line for an image the owner chooses per page, stored with the `x-robots-tag` override and served at 1,200 px wide or more (section 5).

## Could not confirm

- Whether the hosted Supabase service honours an `x-robots-tag` header sent with `upload()`. The source and PR #776 say it does, but it was not tested.
- Whether Google rejects an Organization logo served with `X-Robots-Tag: none`. Google says the logo must be "crawlable and indexable" and that `noindex` covers media, but no page names this case.
- Whether Google merges a Citequill `publisher` with the site's own Organization when both carry one `@id` in separate script blocks. The JSON-LD 1.1 page was too long to read past its first part.
- Whether a browser renders a file stored as `image/png` that holds SVG or HTML when opened directly, given that Supabase sends no `nosniff`. Not tested.
- X's card image rules. `developer.x.com` answered 402.
- The EUR-Lex text of Directive 2000/31/EC. EUR-Lex returned an empty page, so the table cites a reproduction.
- Which Supabase plan this project uses. No doc in the repo says, and image transformations need Pro.
- Whether remark-gfm can turn footnotes off. Not checked.
- How many Polish sites publish their legal name, address and NIP in the footer. No dataset was found.
- The month of the Web Almanac 2024 crawl. The chapter does not state it, and its text and charts disagree on 2 shares.
- The default `tel` scheme of sanitize-html. Its README contradicts itself.
- Vercel's limit on a request body for an upload. Not fetched.

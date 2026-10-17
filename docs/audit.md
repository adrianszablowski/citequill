# Audit

The audit reads every page of the customer's site, checks each one against a fixed catalogue and gives the site a score from 0 to 100. It runs on demand from the Audit section, never on a schedule. It calls no model: every finding has a fixed explanation, a sentence on what Google says and a link to the Google page it stands on. The score has a published formula, this document, so the owner can work out by hand why the number is what it is. The research behind the catalogue is in `research/2026-10-17-seo-audit.md`; the decisions are in [`decisions.md`](decisions.md).

Two readers use the audit. The owner of a site reads what to fix. Citequill reads which pages exist and which of them a page it writes may link to.

## Scope

- Up to 5 000 URLs per audit, in every language of the site. A site with more pages gets an audit of the first 5 000 in discovery order, and the report says so in its header.
- Every page is read as raw HTML, because most crawlers and every AI fetcher read raw HTML. A sample is rendered in a browser as well, because Google renders, and a difference between the two is a finding. A site whose raw HTML is an application shell has every page rendered.
- One audit per project at a time. A second click while one runs opens the running one. A click on a stalled audit cancels its Workflow, ends it as `failed` with the message "The audit made no progress for 15 minutes." and then starts a new one.
- An audit that writes no progress for 15 minutes counts as stalled, the rule of every run. Stop ends it as `failed` with the message "You stopped the audit." and a partial score from the pages read so far, without the checks that compare pages with each other.
- What an audit costs Citequill is measured and stored, and shown to the operator alone. The customer sees pages, time and findings.

## The score

### Formula

Every check in the catalogue has a severity, an area and a set of pages it applies to, named at the top of each catalogue table. A site-level check, such as a missing sitemap, applies to the site and fails or passes as one. A check marked "rendered" or "sample" applies to the pages of the rendered sample.

The failing share of a check is the pages that fail it divided by the pages it applies to, after findings the owner marked as intended are counted as passes. A site-level check has a share of 1 or 0. A page fails a check once, however many times the check fails on it: ten images without alt on one page are one failing page, and the report shows the ten.

```
check penalty = area weight × failing share × (severity / 3)
area penalty  = min(area weight, Σ check penalties of the area)
score         = round(100 − Σ area penalties)
```

So a severity 3 check failing on every page costs its area's whole weight, a severity 2 check failing on every page costs two thirds of it, and two common faults in one area cannot cost more than the area. A check with no data, because the site has no hreflang, no structured data or no images, adds nothing; an area with no data at all costs nothing.

Then the gate: when a gate check fails on the home page, or on more than 10% of the pages it applies to, pages with a noindex of the owner's own left out, the score is capped at 49. A failing site-level gate check caps the score by itself. A mark of intended lifts the gate like any other pass.

### Areas and weights

| Area         | Weight | What is in it                                                                                                       |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Indexability | 35     | robots.txt, noindex, status codes, redirects, canonicals, duplicates, sitemaps, hreflang, spam patterns, the shell  |
| On-page      | 15     | title, description, headings, the head, images and alt text, structured data, Open Graph                            |
| Links        | 15     | broken links and resources, uncrawlable links, orphans, anchor text, links that exist only after JavaScript         |
| HTTPS        | 10     | HTTP, certificates, mixed content, forms over HTTP                                                                  |
| Mobile       | 5      | the viewport, interstitials, content that differs on a phone                                                        |
| Performance  | 10     | response time and compression of the HTML, measured by the audit's own fetch                                        |
| AI access    | 10     | search agents of AI assistants in robots.txt and at the CDN, snippet and archive controls, the shape Bing documents |

Structured data and hreflang have no area of their own: invalid markup costs on-page points and a broken hreflang set costs indexability points, both only when the site has them. Indexability, main content in the raw HTML and working links matter to AI assistants too, but they count once, in their own areas.

### Severity

| Severity | Meaning                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3        | Google documents that the page, or a whole mechanism of the site, stops working: the page is not indexed, not shown or demoted, or a sitemap, an hreflang set or a canonical is ignored. A spam policy. Only a 3 can be a gate |
| 2        | Google documents it as a recommendation, or as the cause of a lost feature or a fault a reader meets: a rewritten title, a lost rich result, a broken image, a form over HTTP                                                  |
| 1        | a convention with a visible effect Google or Bing documents: a title cut off in the results, Bing's advice on the shape of a page                                                                                              |
| hint     | shown in the report with the sentence "Google does not count this", outside the score                                                                                                                                          |
| question | shown as a question to the owner, because only they know the intent: a content page with noindex, a cross-domain canonical                                                                                                     |

The gate checks are the ones Google names as technical requirements, the spam policies, and HTTPS: `robots-googlebot-blocked`, `noindex-site`, `soft-404`, `page-5xx`, `redirect-loop`, `redirect-chain-long`, `spam-pattern`, `https-missing`, `mixed-active`. A recommendation never caps the score, however common its failure, because one template element (a menu item without `href`) would otherwise cap a whole site.

### Bands

| Score     | Band       | Colour |
| --------- | ---------- | ------ |
| 90 to 100 | good       | green  |
| 50 to 89  | needs work | amber  |
| 0 to 49   | poor       | red    |

### Intended

The owner marks a finding as intended at one of three grains: this URL, this selector on every page (the same logo on 300 pages), or the whole check for the project. A marked finding counts as a pass in the score and stays in the report, labelled intended, so the owner sees the audit understood the choice. The marks live in the project: a click recomputes the score and the counters of the latest audit at once, through a database function, and every later audit applies the marks itself; older audits keep the score they had. This holds for the AI access area too: an owner who blocks OAI-SearchBot on purpose marks it, and the score respects the choice.

### While the catalogue is incomplete

The catalogue ships in slices. A check that has not shipped is a check with no data, so the score is computed from the checks that exist, and the score header says how many checks it stands on: "scored from 48 of 116 checks". The comparison with a previous audit is shown only when both audits stand on the same check count.

### Hints

A hint is shown and never scored. Three kinds:

- a tool convention Google says it does not count: description length, H1 count, word count, URL length, heading order, text-to-HTML ratio, keyword density
- a GEO hint from a single or contradicted study, with its evidence labelled
- an accessibility rule beyond alt text, link names and the page language, because accessibility is not a ranking factor

Title length is the one tool convention in the score, at severity 1, because Google cuts a long title in the results and rarely rewrites a good one. The threshold is a width of 600 px in the font of Google's result titles, Citequill's threshold rather than Google's, because "Display" and "iiiiiii" have the same count of characters and a different width.

## The crawl

### Discovery

1. The home page at the base URL of every locale of the project, at click depth 0, then `robots.txt` and every sitemap it names, then `/sitemap.xml` and `/sitemap_index.xml` when robots.txt names none. Up to 50 sitemap files are read, on the site's own hosts only.
2. Every URL of every sitemap, sitemap indexes followed, with `lastmod` and the hreflang, image and video children kept.
3. Then breadth first from the home page by click depth: the links of every fetched page join the queue, on the site's own hosts, every locale included. The site's own hosts are the hosts of the project's locales, each with its `www` twin or its bare twin. The queue lives in the database, not in the Workflow's step arguments. It is read one depth at a time, so a page's click depth is the shortest path from a home page. A URL that only a sitemap lists has no click depth and is read after every URL a click reaches. The target of a redirect joins the queue at the depth of the URL that redirected. Each page records its click depth and the count of pages linking to it, which is what the orphan and depth checks read; the audit keeps no list of who links to whom. The queue keeps the count while the audit runs and the page's row in `site_pages` takes it when the audit ends.
4. URLs with query parameters are read up to 50 per path, enough to say "this path has indexable facets" without spending the budget on them. Fragments are dropped.
5. The queue stops at 5 000 URLs, blocked ones included. When a URL is refused because the queue is full, the audit is partial.

### Rate and manners

- 5 requests a second to the site, fixed, every host of the site together, with up to 5 requests in flight. A request waits for its turn before its 15 seconds start, and each further hop of a redirect takes a turn of its own. On 429 or 503 the audit waits for `Retry-After`, or doubles its pause up to a minute, and goes on; a `Retry-After` longer than a minute is cut to a minute. The URL is asked again up to 3 times and then recorded with the answer it got. Twenty 429, 5xx or time-out answers in a row end the audit as `failed` with the message that the site stopped answering or rate-limited the audit, because carrying on would hit a server that is down. A request that gets no connection counts as a time-out. The count and the pause carry over from one step to the next.
- A Workflow step runs for at most 300 seconds on the Hobby plan, so each step takes 50 URLs, has a wall budget of 240 seconds, and returns what it did not read to the queue. On the Pro plan the limit is 800 seconds and the budget 600.
- Every request carries the user agent `CitequillBot/1.0 (+https://citequill.com/bot)`. The page at `citequill.com/bot` says what the bot does, how to block it in robots.txt and how to let it through a firewall.
- Every request to the site's own hosts, over https and http alike, carries the project's bot secret in the header `Citequill-Bot-Secret`, the renderer's requests included; the header never goes to a foreign host or on a redirect hop off the site. The owner pastes the secret into a WAF skip rule in Cloudflare or a bypass rule in the Vercel firewall, because function IP addresses change and a user agent is spoofable. Cloudflare's Free plan has Bot Fight Mode, which no rule bypasses; its owner turns it off for the audit. The secret is generated per project, shown in Settings with the two instructions and one sentence saying it is sent over http too, and can be regenerated there. The CDN test below is the one request that leaves the header out.
- Each request to the site is one guarded fetch, the crawl's `fetchPublic()` with headers, HEAD and 10 hops added: public hosts only, redirects by hand with the hop chain recorded, 15 seconds, the body cut at 2 MB, which is where Googlebot stops too.

### robots.txt

- By default the audit obeys robots.txt as Googlebot does: the `Googlebot` group when there is one, else `*`. A disallowed URL is recorded as blocked, not fetched, and reported. Matching follows Google: the longest rule wins, and an allow wins a tie. The owner turns this off in Settings for the project, so the audit reads what robots.txt hides; the choice is recorded. Two checks, `noindex-blocked` and the noindex half of `sitemap-url-error`, need the content of a disallowed page and run only when the switch is off.
- A `CitequillBot` group, when the owner wrote one, has its rules honoured always, because it is the owner's explicit word to this bot. With the switch on, a URL is blocked when either the Googlebot rules or the `CitequillBot` group disallow it; with the switch off, only the `CitequillBot` group blocks. `Crawl-delay` is ignored in every group, the `CitequillBot` group included, as Google ignores it; it shows up only through the `robots-unsupported` hint about the site's own file.
- The rules for AI agents are read only to report them.
- robots.txt is read once per audit, from every origin the audit may fetch: each of the site's own hosts, over https and over http, because a robots.txt governs only its own host and scheme, and a site on several domains has one on each. A 4xx means no restrictions. A 5xx or a time-out is a finding and the audit treats the site as fully allowed, so the owner sees the pages; Google stops crawling for 12 hours, then uses its cached copy for 30 days, or crawls freely when it has none.

### Resources and external links

- Every distinct internal image URL on every page is checked once with a HEAD request, GET when HEAD is refused, because a broken image sits on one page and the report names it. Scripts and stylesheets are checked for the rendered sample only, because a broken script is a feature of the template and the sample finds it.
- Every distinct external link is checked once, HEAD then GET, one retry, at 2 requests a second per foreign host. A 403 or 429 from a foreign host is reported as "the host refuses bots", never as a broken link.
- Both run in steps of 50 URLs like the pages, with the same wall budget.

### The CDN test

The home page is fetched once with the user agent of each AI search agent in `ai-search-bots-blocked`, without the bot secret. A 403, 402 or a challenge page is a finding with strict wording: "fetched with the user agent of OAI-SearchBot from Citequill's address, the home page answered 403; check the Search and Agent settings in Cloudflare's AI Crawl Control". It is an approximation: a CDN verifies bots by address and signature too, so the real agent may pass where we did not, or fail where we passed. When the home page also fails with the bot secret, the finding says Citequill's own address was blocked instead. The wording says what was done and where to look. The bot page says the audit does this.

## Rendering

### The shell test

A page is a shell when its raw HTML has under 200 characters of visible text outside the header, navigation and footer, or its body is one empty root element (`#root`, `#__next`, `#app`), or a `<noscript>` says JavaScript is required. The test reads raw HTML only and runs on the home page and on the sample. When the home page and the majority of the sample are shells, the audit renders every page it read, on 10 sandboxes of 2 vCPU each.

### The sample

The home page, every top-level page up to 10, then one page per URL pattern until 50 pages. A pattern is the path with every segment that looks like an identifier (digits, UUIDs, dates) replaced by a placeholder, grouped by its first segment and its depth. Differences between raw and rendered HTML are a feature of the template, so one page per pattern finds them all.

The sample is fetched again, raw, with a phone's user agent. That fetch is the raw side of every raw-versus-rendered comparison, so a site that serves a phone template is not reported as "links appear only after JavaScript", and it is the phone side of the checks that compare phone and desktop content.

### The engine

Rendering runs in a Vercel Sandbox from Citequill's own image: a Dockerfile in `sandbox/render/` with Playwright's Chromium, built by the owner with `vercel vcr build`, as the owner pushes migrations. A Workflow step mints a token for this audit, stores its hash on the audit with an expiry, creates the sandboxes with the URLs and the token, sets their timeout and turns persistence off, and starts the render script detached. The script posts each page's result to an API route of Citequill, outside the sign-in proxy, that checks the token, that the audit is still running and that the URL is in the render set, and accepts a repeated post for one URL once; the sandbox never holds the Supabase secret key. The workflow waits on a hook that the route resumes when a sandbox reports done, then a step ends the sandboxes and clears the token; Stop does the same. Playwright sends the bot secret and the Googlebot Smartphone user agent, so the CDN treats the renderer as it treats the crawler.

Renderer settings, Google's documented ones where they exist and Screaming Frog's where Google is silent: Chromium, viewport 411 by 731, the Googlebot Smartphone user agent, no interaction, wait for `load` and then up to 5 seconds of network quiet, a hard cap of 10 seconds per page, media and fonts blocked.

### What is compared

Title, meta description, meta robots, canonical, H1, the `<a href>` set, the `<img src>` set, the JSON-LD blocks and the length of the main content, rendered against the phone fetch of the same page. Each difference is a finding: "canonical present only after JavaScript", "noindex only in the raw HTML", "47 links appear only after JavaScript".

## The catalogue

Each check has an identifier the findings, the marks and the report use. Severity 3, 2 and 1 count in the score; hint and question do not. "Gate" marks a check that caps the score at 49 as the formula says. "Rendered" marks a check that needs the rendered DOM and applies to the sample; "sample" marks a check that needs the sample's second fetch. "Slice 6" marks the structured data and hreflang checks, which ship in that slice and count as no data until then. The raw pass reads attributes and inline styles only; a rule that needs computed styles or layout is marked rendered. The catalogue has 181 rows, 116 of them scored.

### Indexability, weight 35

Page-level checks apply to the indexable pages unless the rule says otherwise; a check on a redirect, a canonical or a sitemap entry applies to the URLs that have one.

| Check                       | Rule                                                                                                                           | Severity    | What Google says                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| `robots-5xx`                | `/robots.txt` answers 5xx or times out                                                                                         | 3           | Google stops crawling for 12 hours, then uses its cached copy for 30 days, or crawls freely   |
| `robots-googlebot-blocked`  | the `Googlebot` or `*` group disallows the home page or content paths                                                          | 3, gate     | a page Googlebot cannot reach is not indexed                                                  |
| `robots-assets-blocked`     | a stylesheet or script an indexable page uses is disallowed                                                                    | 2           | Google needs them to render the page                                                          |
| `robots-size`               | over 500 KiB, or reached through more than 5 redirects                                                                         | 2           | Google reads the first 500 KiB                                                                |
| `robots-unsupported`        | `crawl-delay`, `noindex` or `host` lines                                                                                       | hint        | Google ignores fields it does not list                                                        |
| `robots-4xx`                | `/robots.txt` answers 4xx                                                                                                      | hint        | no restrictions                                                                               |
| `noindex-site`              | the home page carries noindex, or over 95% of pages do                                                                         | 3, gate     | a page must be indexable to appear                                                            |
| `noindex-content`           | an article, product, service or landing page carries noindex                                                                   | question    | remove it if the page should appear                                                           |
| `noindex-blocked`           | a page with noindex is also disallowed in robots.txt; runs with the robots.txt switch off                                      | 2           | the crawler never sees the noindex, so the page can stay indexed                              |
| `robots-conflict`           | meta robots and `X-Robots-Tag` disagree                                                                                        | 2           | the most restrictive rule wins                                                                |
| `robots-invalid`            | `max-snippet` without an integer, an unparsable `unavailable_after`                                                            | hint        | an invalid value is ignored                                                                   |
| `robots-none`               | `none` used                                                                                                                    | hint        | Bing does not list it                                                                         |
| `unavailable-after-past`    | an indexable page with `unavailable_after` in the past                                                                         | 2           | the page is removed on that date                                                              |
| `noindex-rendered-only`     | noindex only in the rendered DOM, or removed by JavaScript                                                                     | 2, rendered | rendering may be delayed or skipped                                                           |
| `soft-404`                  | 200 with error phrases, a near-empty body, or a random missing path answers 200                                                | 3, gate     | return a real 404 or 410                                                                      |
| `html-over-2mb`             | uncompressed HTML over 2 MB                                                                                                    | 2           | Googlebot reads the first 2 MB                                                                |
| `search-results-indexable`  | `/search`, `?s=`, `?q=` answer 200 without noindex and are not disallowed                                                      | 2           | block internal search results                                                                 |
| `facets-indexable`          | sort and filter parameters answer 200, self-canonical, in volume; a facet with no results answers 200                          | 2           | block or noindex facets; an empty combination answers 404                                     |
| `pagination-canonical`      | `?page=n` carries noindex or a canonical to page 1; pagination by fragment                                                     | 2           | each page is its own canonical; `rel=next` is no longer used                                  |
| `staging-indexable`         | a linked host matching staging, dev or test answers 200 without noindex                                                        | 2           | robots.txt does not keep URLs out of the index; use noindex or a password                     |
| `shell`                     | the raw HTML fails the shell test                                                                                              | 3           | Google renders, in a queue; most crawlers and every AI fetcher do not                         |
| `thin-page`                 | main content under 150 words                                                                                                   | hint        | no word count target exists; scaled content abuse and thin affiliation are spam policies      |
| `utility-indexable`         | print, thank-you and login pages indexable                                                                                     | hint        | print versions are duplicates                                                                 |
| `page-4xx`                  | a linked or listed internal page answers 4xx, 401 or 403                                                                       | 3           | all 4xx are alike: the page is treated as gone; fix the links and sitemap entries             |
| `page-5xx`                  | 5xx, or no answer in 15 seconds                                                                                                | 3, gate     | 5xx and 429 slow crawling; a URL that keeps erroring is dropped                               |
| `redirect-chain`            | 2 to 10 hops                                                                                                                   | 2           | fewer hops                                                                                    |
| `redirect-chain-long`       | still redirecting after 10 hops                                                                                                | 3, gate     | Googlebot follows up to 10 hops                                                               |
| `redirect-loop`             | a URL recurs in its own chain                                                                                                  | 3, gate     | a redirect error                                                                              |
| `redirect-to-error`         | a redirect ends on 4xx or 5xx                                                                                                  | 3           | broken                                                                                        |
| `redirect-temporary`        | 302, 303 or 307 with the same target as the previous audit                                                                     | hint        | a weak signal; the source tends to stay indexed                                               |
| `redirect-meta`             | `<meta http-equiv="refresh">` with no server redirect                                                                          | 2           | instant meta refresh is permanent, delayed is temporary                                       |
| `redirect-script`           | a `location` change on load with no server redirect                                                                            | 2, rendered | JavaScript redirects come last                                                                |
| `redirect-to-home`          | a missing path redirects to the home page                                                                                      | 2           | a soft 404                                                                                    |
| `redirect-slash-or-case`    | a redirect only fixes a trailing slash or letter case                                                                          | hint        | avoidable                                                                                     |
| `canonical-missing`         | an indexable page names no canonical                                                                                           | hint        | not required; Google chooses                                                                  |
| `canonical-outside-head`    | a `rel=canonical` in the body                                                                                                  | 2           | the canonical must be in `<head>`                                                             |
| `canonical-relative`        | a relative canonical, or one with a fragment                                                                                   | 2           | listed mistakes                                                                               |
| `canonical-conflict`        | several canonicals, or the header and the HTML disagree                                                                        | 3           | name one canonical by one method, or Google ignores them and chooses                          |
| `canonical-rendered-only`   | the canonical differs between raw and rendered HTML                                                                            | 2, rendered | do not change the canonical with JavaScript                                                   |
| `canonical-to-error`        | the canonical points to a redirect, 4xx, 5xx or noindex page                                                                   | 3           | the canonical is the URL you want indexed                                                     |
| `canonical-chain`           | A names B and B names C                                                                                                        | 2           | one hop; a tool convention Google does not rule on                                            |
| `canonical-cross-domain`    | the canonical is on another host                                                                                               | question    | legitimate for syndication; Google warns about injected ones                                  |
| `canonical-language`        | the canonical points to another language, or to HTTP from HTTPS                                                                | 3           | same language; an HTTP canonical can make Google prefer HTTP                                  |
| `host-variants`             | `www` and bare host, trailing slash and not, or two letter cases all answer 200 for one path; probed on a sample of 20 paths   | 2           | pick one and redirect or canonicalise                                                         |
| `param-duplicates`          | tracking or session parameters in internal links; the same content under two or more parameter variants                        | 2           | remove parameters that do not change the content                                              |
| `duplicate-body`            | two indexable pages with the same body hash and no canonical between them                                                      | 2           | not spam; Google consolidates, but it wastes crawling                                         |
| `near-duplicate`            | body similarity above 90%                                                                                                      | hint        | no threshold exists                                                                           |
| `markdown-parity`           | a markdown version of the page says something its HTML does not                                                                | 2           | the same content under one URL in another format; a version for bots is what cloaking forbids |
| `spam-pattern`              | inline `display:none` blocks of keywords, unnatural repetition, near-identical city or keyword pages                           | 3, gate     | spam policies                                                                                 |
| `sitemap-missing`           | robots.txt names none and `/sitemap.xml` is not 200                                                                            | 2           | optional but recommended                                                                      |
| `sitemap-unreachable`       | a named sitemap is not 200, or redirects off the host                                                                          | 3           | "Couldn't fetch": the whole sitemap is ignored                                                |
| `sitemap-not-in-robots`     | no `Sitemap:` line                                                                                                             | hint        | a discovery aid                                                                               |
| `sitemap-limits`            | over 50 000 URLs or 50 MB; an index over 50 000 entries                                                                        | 3           | hard limits                                                                                   |
| `sitemap-invalid`           | not UTF-8, wrong namespace, unescaped `&`, relative `<loc>`, `<loc>` over 2 048 characters                                     | 3           | sitemaps.org; the file is not read                                                            |
| `sitemap-scope`             | a URL with another protocol, host or a path above the sitemap                                                                  | 3           | "URL not allowed"                                                                             |
| `sitemap-url-error`         | a listed URL answers 4xx or 5xx, or carries noindex when the robots.txt switch is off                                          | 3           | list only the URLs you want in Search                                                         |
| `sitemap-url-noncanonical`  | a listed URL redirects, names another canonical, is HTTP on an HTTPS site, or is disallowed                                    | 2           | list the canonical URL                                                                        |
| `page-not-in-sitemap`       | an indexable, self-canonical 200 page is in no sitemap                                                                         | 2           | list the pages you want found; the owner asked for this one                                   |
| `sitemap-lastmod`           | wrong format, in the future, or identical on over 90% of entries                                                               | 2           | used only when consistently accurate; omit it rather than guess                               |
| `sitemap-priority`          | `priority` or `changefreq` present                                                                                             | hint        | ignored                                                                                       |
| `sitemap-extensions`        | over 1 000 images per URL, deprecated image tags, a video entry missing required tags, news over 1 000 URLs or over 2 days old | 2           | per extension                                                                                 |
| `sitemap-hreflang`          | a `<url>` with alternates that does not list itself, or clusters that disagree                                                 | 3, slice 6  | every URL lists every alternate including itself, or the set is ignored                       |
| `hreflang-return`           | a missing return link, a page that does not list itself, clusters that disagree                                                | 3, slice 6  | without return links the set is ignored                                                       |
| `hreflang-code`             | an invalid language or region code, a region without a language, a relative URL                                                | 3, slice 6  | ISO 639-1 and ISO 3166-1 alpha-2; an invalid entry is ignored                                 |
| `hreflang-target`           | an alternate answers non-200 or carries noindex                                                                                | 3, slice 6  | the alternate must be indexable                                                               |
| `hreflang-target-canonical` | an alternate names another canonical                                                                                           | 2, slice 6  | point at the canonical                                                                        |
| `hreflang-http`             | an HTTP alternate on an HTTPS site                                                                                             | 2, slice 6  | HTTPS                                                                                         |
| `hreflang-x-default`        | no `x-default` with 2 or more languages                                                                                        | hint        | recommended for a chooser page, not required                                                  |
| `hreflang-methods`          | two methods in use and they differ                                                                                             | 2, slice 6  | one method                                                                                    |
| `hreflang-on-canonical`     | an hreflang attribute on `rel=canonical`                                                                                       | hint        | ignored                                                                                       |
| `html-lang`                 | `<html lang>` missing or invalid, or disagreeing with the hreflang self-entry                                                  | hint        | Google does not read it for language; WCAG 3.1.1 does                                         |

### On-page, weight 15

Title, description, heading and head checks apply to the indexable pages; image checks to the pages with images exposed to assistive technology; structured data checks to the pages with JSON-LD; Open Graph checks to the indexable pages.

| Check                        | Rule                                                                                                                    | Severity       | What Google says                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `title-missing`              | no title, an empty one, several, or one outside `<head>`                                                                | 2              | a descriptive title is a key best practice                                      |
| `title-duplicate`            | the same title on two or more indexable pages                                                                           | 2              | boilerplate titles get rewritten                                                |
| `title-boilerplate`          | half-empty, or boilerplate shared across pages                                                                          | 2              | listed rewrite causes; a repeated site name is dropped from the link            |
| `title-stuffed`              | a word repeated 3 or more times                                                                                         | 2              | avoid stuffing                                                                  |
| `title-width`                | wider than 600 px in the result font                                                                                    | 1              | no length limit; the result cuts it at the device's width                       |
| `title-language`             | the title's language differs from the page's                                                                            | hint           | a listed rewrite cause                                                          |
| `title-rendered-only`        | the title differs between raw and rendered HTML                                                                         | hint, rendered | rendering may be delayed                                                        |
| `description-missing`        | no description, several, or one outside `<head>`                                                                        | 2              | snippet control                                                                 |
| `description-duplicate`      | the same description on two or more pages                                                                               | hint           | snippet quality                                                                 |
| `description-length`         | over 160 or under 70 characters                                                                                         | hint           | no length limit; used only when it describes the page better than the text does |
| `h1-missing`                 | no H1                                                                                                                   | 2              | a visible main heading is a title link source                                   |
| `h1-count`                   | several H1s, the same H1 on several pages, an H1 over 70 characters                                                     | hint           | any number is fine                                                              |
| `heading-order`              | an h3 without an h2 above it                                                                                            | hint           | order does not matter for ranking; it helps screen readers                      |
| `head-invalid`               | doctype or charset missing; an element in `<head>` that is not allowed there                                            | 2              | head elements after an invalid one are not read                                 |
| `lorem-ipsum`                | placeholder text                                                                                                        | 2              | a quality fault a reader meets; no Google rule                                  |
| `plugins`                    | frames, Flash, Java, Silverlight                                                                                        | hint           | no longer a priority                                                            |
| `text-ratio`                 | low word count, text-to-HTML ratio, readability band                                                                    | hint           | not factors                                                                     |
| `content-stale`              | `Last-Modified` or a visible date over 6 months old                                                                     | hint           | an obsolete date in a title triggers a rewrite                                  |
| `url-shape`                  | underscores, uppercase, non-ASCII, double slashes, over 4 parameters, over 115 characters                               | hint           | hyphens and few parameters; length is a tool convention                         |
| `img-alt-missing`            | `<img>` without an `alt` attribute, exposed to assistive technology, with no `aria-label`, `aria-labelledby` or `title` | 2              | alt text is how Google understands an image                                     |
| `img-alt-whitespace`         | `alt=" "` or other whitespace                                                                                           | 2              | the role stays img with an empty name                                           |
| `img-generator-blank`        | `generator-unable-to-provide-required-alt`                                                                              | 2              | the CMS left it blank; it is not a decorative marker                            |
| `img-decorative-focusable`   | `alt=""`, `role="presentation"` or `role="none"` on an image with `tabindex`                                            | 2              | the role comes back with no name                                                |
| `img-decorative-title`       | `alt=""` with a non-empty `title`                                                                                       | hint           | a decorative image carries no title                                             |
| `img-title-only`             | no `alt` but a non-empty `title`                                                                                        | hint           | valid, never recommended                                                        |
| `img-figure-no-alt`          | no `alt`, the sole content of a `<figure>` with a `<figcaption>`                                                        | hint           | allowed; every checker wants an alt                                             |
| `img-alt-redundant`          | an image in a link whose alt equals the adjacent text                                                                   | hint           | read twice; the fix is `alt=""`                                                 |
| `img-alt-filename`           | the alt equals the file name, or is "image", "picture" or "logo" alone                                                  | 2              | Google's "bad" example                                                          |
| `img-alt-long`               | over 100 characters                                                                                                     | hint           | a few words                                                                     |
| `img-alt-stuffed`            | repeated words or a list of keywords                                                                                    | 2              | may be seen as spam                                                             |
| `svg-no-name`                | inline `<svg role="img">` with no `<title>` first child, `aria-label` or `aria-labelledby`                              | 2              | an image with no name                                                           |
| `svg-no-role`                | inline `<svg>` with no role and no `aria-hidden`                                                                        | hint           | one or the other                                                                |
| `icon-no-name`               | an element with `role="img"` and no name                                                                                | 2              | an image with no name                                                           |
| `picture-no-src`             | a `<picture>` whose `<img>` lacks `src`                                                                                 | 2              | always specify a fallback `src`                                                 |
| `img-lazy-first-viewport`    | `loading="lazy"` on an image in the first viewport or on the largest element                                            | 2, rendered    | delays the largest paint                                                        |
| `img-lazy-scripted`          | lazy loading by scroll or click events                                                                                  | 2, rendered    | Google does not interact with the page                                          |
| `img-no-dimensions`          | no `width` and `height` attributes and no inline `aspect-ratio`                                                         | 2              | layout shift                                                                    |
| `img-heavy`                  | a file over 100 KB                                                                                                      | hint           | compress                                                                        |
| `img-oversized`              | an image larger than its display box                                                                                    | hint, rendered | serve responsive images                                                         |
| `img-filename-generic`       | `IMG_1234.jpg` on a content image                                                                                       | hint           | short but descriptive                                                           |
| `jsonld-invalid`             | JSON-LD that does not parse, or a wrong or missing `@context`                                                           | 2, slice 6     | no rich result                                                                  |
| `jsonld-unknown-type`        | a `@type` schema.org does not define                                                                                    | 2, slice 6     | ignored                                                                         |
| `jsonld-dropped-feature`     | a type for a result Google no longer shows: HowTo, FAQ, sitelinks search box and the rest                               | hint           | no error, no result                                                             |
| `jsonld-required-missing`    | a required property of a supported type is missing                                                                      | 2, slice 6     | the type's documentation                                                        |
| `jsonld-recommended-missing` | a recommended property is missing                                                                                       | hint           | the type's documentation                                                        |
| `jsonld-mismatch`            | name, headline, price or rating differs from the visible text                                                           | 3, slice 6     | mark up only visible content; a manual action removes rich results              |
| `jsonld-self-review`         | a review or rating of the organisation on its own `Organization` or `LocalBusiness`                                     | 3, slice 6     | self-serving reviews make the page ineligible                                   |
| `jsonld-image-unreachable`   | an image URL in the markup is not fetchable                                                                             | 2, slice 6     | images must be crawlable                                                        |
| `jsonld-image-small`         | an `Article` image under 50 000 px                                                                                      | hint           | the type's documentation                                                        |
| `jsonld-logo-small`          | an `Organization` logo under 112 px                                                                                     | hint           | the type's documentation                                                        |
| `jobposting-expired`         | a `JobPosting` past `validThrough`                                                                                      | 3, slice 6     | remove expired postings                                                         |
| `merchant-price-zero`        | a merchant listing with `AggregateOffer` or a price of 0                                                                | 3, slice 6     | the type's documentation                                                        |
| `breadcrumb-short`           | a `BreadcrumbList` under 2 items                                                                                        | 2, slice 6     | the type's documentation                                                        |
| `structured-data-format`     | microdata or RDFa instead of JSON-LD; no structured data at all                                                         | hint           | JSON-LD is recommended                                                          |
| `og-missing`                 | `og:title`, `og:description`, `og:image`, `og:url` or `og:type` missing                                                 | hint           | Google reads `og:title` and `og:image` as inputs                                |
| `og-image-bad`               | `og:image` not fetchable, tiny or the site logo; `og:url` differs from the canonical                                    | hint           | sharing previews                                                                |
| `twitter-card`               | `twitter:card` missing                                                                                                  | hint           | sharing previews                                                                |

An image is skipped, never listed: `aria-hidden="true"` on it or an ancestor, an inline `display:none` or `visibility:hidden` on it or an ancestor, a CSS background, or `alt=""` with 0 or 1 pixel dimensions. On the rendered sample the computed styles decide. An image with `alt=""`, `role="presentation"` or `role="none"` passes as decorative, and the report counts the decorative images as passes, because the HTML standard requires exactly `alt=""` for a decorative image and whether an image is decorative is a judgment only the author can make.

### Links, weight 15

Link checks apply to the indexable pages; `link-broken-external` to the pages with external links; `resource-broken` to the pages with images, and to the sample for scripts and stylesheets.

| Check                    | Rule                                                                                         | Severity    | What Google says                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `link-broken-internal`   | an internal `href` answers 4xx or 5xx                                                        | 3           | links must work                                                           |
| `link-broken-external`   | an external `href` answers 4xx, 5xx or nothing after a retry; 403 and 429 are reported apart | 2           | a reader and an assistant following a citation find nothing               |
| `resource-broken`        | an internal image on any page, or a script or stylesheet on the sample, is not 200           | 2           | broken content a reader meets                                             |
| `link-uncrawlable`       | an anchor with no `href` or a `javascript:` href                                             | 3           | a link is an `<a>` with an `href`; Google may still try to resolve others |
| `link-scripted`          | a click handler standing for a link                                                          | 2, rendered | Google does not interact with the page                                    |
| `link-malformed`         | `localhost`, `file:`, a UNC path, an empty or malformed `href`                               | 2           | broken for users                                                          |
| `link-to-redirect`       | an internal link to a 3xx URL or to a page that names another canonical                      | hint        | a listed mistake                                                          |
| `link-nofollow-internal` | an internal link with `rel="nofollow"`                                                       | hint        | a hint, not a directive; use robots.txt on your own site                  |
| `page-no-outlinks`       | an indexable page with no internal links                                                     | 2           | links help discovery                                                      |
| `orphan`                 | an indexable page with no inbound internal link, found by the sitemap alone                  | 2           | Google finds pages mainly through links                                   |
| `link-depth`             | one inbound link only, or 4 or more clicks from the home page                                | hint        | clicks from the home page matter, slashes do not                          |
| `link-count`             | over 3 000 links on a page                                                                   | hint        | no current limit                                                          |
| `anchor-generic`         | "click here", "read more", "learn more" or a bare URL as the text of an internal link        | 2           | use the words people search for                                           |
| `anchor-empty`           | a link with no text and no name, an image-only link included                                 | 2           | the alt is the anchor text; without it there is none                      |
| `link-blank-noopener`    | `target="_blank"` without `rel="noopener"`                                                   | hint        | security, not SEO                                                         |
| `link-rendered-only`     | internal links present only after JavaScript                                                 | 2, rendered | a crawler that does not render never follows them                         |

### HTTPS, weight 10

All checks apply to the pages read.

| Check                | Rule                                                                              | Severity | What Google says                                                                   |
| -------------------- | --------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `https-missing`      | a page served over HTTP, or HTTP not redirected to HTTPS                          | 3, gate  | a lightweight ranking signal; Chrome 154 is to warn before the first visit to HTTP |
| `https-to-http`      | an HTTPS URL redirects to HTTP                                                    | 3        | Google may prefer the HTTP canonical                                               |
| `tls-invalid`        | an invalid or mismatched certificate, TLS 1.0, no SNI                             | 3        | Google may prefer the HTTP canonical; browsers block                               |
| `mixed-active`       | a script, stylesheet or iframe over HTTP on an HTTPS page                         | 3, gate  | browsers block it                                                                  |
| `mixed-passive`      | an image or media file over HTTP; an HTTPS page linking to HTTP pages of the site | 2        | Chrome upgrades or fails the image                                                 |
| `form-on-http`       | a form or password field on an HTTP page                                          | 2        | Chrome marks it not secure                                                         |
| `content-type-wrong` | an HTML page served with another `Content-Type`                                   | 2        | can break indexing of the document                                                 |
| `protocol-relative`  | `//host/file` resource URLs                                                       | hint     | avoidable                                                                          |
| `security-headers`   | HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` missing | hint     | no SEO effect; HSTS reinforces HTTPS                                               |

### Mobile, weight 5

Viewport checks apply to the indexable pages; the rest to the sample.

| Check                    | Rule                                                                           | Severity       | What Google says                                          |
| ------------------------ | ------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------- |
| `viewport-missing`       | no viewport meta                                                               | 3              | mobile-first indexing; responsive design recommended      |
| `viewport-misconfigured` | no width, a fixed width, or `user-scalable=no`                                 | 2              | accessibility; the same content on mobile                 |
| `mobile-content-differs` | main content, headings or links differ between the phone and the desktop fetch | 2, sample      | content missing on mobile is not indexed                  |
| `interstitial`           | an overlay covering the main content on load                                   | 2, rendered    | may lead to poor search performance; legal gates are fine |
| `mobile-layout`          | content wider than the viewport, fonts too small, tap targets too close        | hint, rendered | Lighthouse moved these out of SEO                         |

### Performance, weight 10

Measured by the audit's own fetch from Vercel's region, during the crawl, with no third-party API; the report names the region. Field Core Web Vitals from the Chrome UX Report and lab runs from PageSpeed Insights are in the backlog. The checks apply to the pages read.

| Check               | Rule                                                              | Severity | What Google says                     |
| ------------------- | ----------------------------------------------------------------- | -------- | ------------------------------------ |
| `html-slow`         | the HTML answers in over 800 ms, the median of the page's fetches | 2        | TTFB good under 800 ms, from web.dev |
| `html-uncompressed` | no `gzip` or `br` on the HTML                                     | 2        | smaller is faster; a tool convention |
| `assets-uncached`   | a script or stylesheet with no cache headers                      | hint     | performance                          |
| `assets-heavy`      | over 100 files or 2 MB of scripts and stylesheets                 | hint     | performance                          |
| `dom-size`          | over 1 500 nodes                                                  | hint     | performance                          |

### AI access, weight 10

Google-Extended controls Gemini training and grounding and has no effect on Search; AI Overviews and AI Mode are served from the normal index and controlled by Googlebot's rules. The vendors separate training agents, search agents and user-fetch agents: blocking a training agent costs no visibility, blocking a search agent removes the site from that assistant's answers. OpenAI and Perplexity say their user-fetch agents may not follow robots.txt; Anthropic says Claude-User does. Since 1 July 2025 Cloudflare has blocked AI training crawlers by default for new domains; since 1 July 2026 it manages AI traffic in three categories, Search, Agent and Training; since 15 September 2026 new domains block Training and Agent on pages with ads while Search stays allowed, and a crawler that both searches and trains gets the strictest rule. So a site can be unreadable to assistants through a setting the owner never chose. Robots checks apply to the site; the rest to the indexable pages.

| Check                      | Rule                                                                                                                                            | Severity | What the engines say                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `ai-search-bots-blocked`   | OAI-SearchBot, Claude-SearchBot, PerplexityBot, Bingbot, Applebot, MistralAI-Index, DuckAssistBot, Amzn-SearchBot or meta-webindexer disallowed | 2        | the assistant's search index does not include the site                                                        |
| `ai-cdn-blocked`           | the home page fetched with a search agent's user agent, without the bot secret, answers 403, 402 or a challenge                                 | 2        | the strict wording of the CDN test above                                                                      |
| `nosnippet`                | `nosnippet` or `data-nosnippet` on the main content                                                                                             | 2        | the page is not used in AI Overviews or AI Mode, nor in Siri and Apple's AI answers                           |
| `max-snippet-small`        | `max-snippet` under 160, Citequill's threshold                                                                                                  | 1        | limits what AI features may quote; Google names no threshold                                                  |
| `noarchive`                | `noarchive`                                                                                                                                     | 2        | Bing drops the page from Copilot answers and grounding; Google ignores it                                     |
| `nocache`                  | `nocache` without `noarchive`                                                                                                                   | 1        | Bing lets Copilot use only the URL, title and snippet; Google ignores it                                      |
| `answer-first`             | the main content opens with a paragraph of text and the H1 sits in the first quarter of the visible text; Citequill's proxy                     | 1        | Bing: place essential information near the top                                                                |
| `one-topic`                | title, H1 and description share no content word; Citequill's proxy                                                                              | 1        | Bing: focus each URL on a single topic                                                                        |
| `ai-training-bots-blocked` | GPTBot, ClaudeBot, Google-Extended, Meta-ExternalAgent, Applebot-Extended, MistralAI-Training, Amazonbot or CCBot disallowed                    | hint     | the owner's choice; no visibility lost                                                                        |
| `ai-user-agents-blocked`   | ChatGPT-User, Claude-User, Perplexity-User, MistralAI-User, Amzn-User or meta-externalfetcher disallowed                                        | hint     | ChatGPT-User, Perplexity-User, Amzn-User and meta-externalfetcher may ignore the rule; Claude-User honours it |
| `content-signals`          | a `Content-Signal` line in robots.txt                                                                                                           | hint     | Cloudflare's Content Signals: `search`, `ai-input`, `ai-train`, honoured by Cloudflare's crawler controls     |
| `pay-per-crawl`            | 402 with a `crawler-price` header                                                                                                               | hint     | Cloudflare's Pay Per Crawl is in force                                                                        |
| `indexnow-key`             | the IndexNow key file present                                                                                                                   | hint     | Bing and partners only                                                                                        |

### GEO hints

Shown outside the score, each with its evidence label, because the evidence is correlation from vendors' studies.

| Hint                 | Rule                                                                                                                                                                                                                                | Evidence label                                                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `geo-freshness`      | `dateModified`, `Last-Modified` or a visible date within the last 12 months                                                                                                                                                         | Ahrefs, July 2025, 17 million citations on 6 platforms; Seer, June 2025, 5 000 URLs, and July 2026, 4 124 pages: fresher pages are cited more, except in Google AI Overviews. Correlation        |
| `geo-qa-structure`   | headings written as questions, each followed by an answer paragraph                                                                                                                                                                 | Semrush, January 2026, 11 882 prompts on ChatGPT, Google AI Mode and Perplexity, 304 805 cited URLs: question-and-answer pages 25% more often cited. Correlation; the study sells a Semrush tool |
| `geo-source-links`   | outbound links to `.gov` or `.edu` sources                                                                                                                                                                                          | Seer, May 2026, 6 354 pages winning Google AI Overviews for 8 500 keywords: winners link to about twice as many `.gov` and `.edu` sources. Google only. Correlation                              |
| `geo-slug`           | the slug is words, not an id                                                                                                                                                                                                        | Ahrefs, April 2026, 1.4 million ChatGPT prompts: pages with natural-language slugs cited 89.8% of the time they were retrieved, against 81.1%. ChatGPT only. Correlation                         |
| `markdown-alternate` | the page negotiates `Accept: text/markdown` with `text/markdown` and `Vary: Accept`; a `<link rel="alternate" type="text/markdown">`; a `.md` suffix answering 200 with the right type; `llms.txt` as markdown with an H1 and links | Claude Code, OpenCode and Cursor send `Accept: text/markdown`; Cloudflare has seen OAI-SearchBot ask for it; a 381-page controlled test found no change in bot visits. Helps coding agents       |

Left out on purpose, because the evidence says they do nothing or cannot be checked from HTML: `llms.txt` as a ranking or citation factor (Google says no new machine-readable files are needed, and Ahrefs found 97% of `llms.txt` files on 137 210 domains got no request in a month), structured data as a lever for citations (Ahrefs, May 2026, 1 885 pages against 4 000 controls: no lift for pages already cited), "noai" meta tags (no engine documents them), the levers of the Princeton GEO paper (added statistics, quotes, fluency, measured on a simulated engine and on Perplexity with uploaded files, never replicated on live web retrieval, and not checkable from HTML), page length (Seer found definitional winners either under 250 words or at 1 000 to 2 000; Ahrefs found a 0.04 correlation on 174 048 pages), and off-site signals such as mentions and backlinks.

### Accessibility

Accessibility is not a direct ranking factor. The audit scores the overlap with search: alt text, link names, the title, the viewport. It reports `<html lang>` and heading order as hints and leaves the rest of WCAG to accessibility tools.

## The report

The Audit section opens on the latest audit. The first card is the score with its band, the check count the score stands on, the date, the pages read and rendered, the time taken, and the difference from the previous audit when both stand on the same checks: "+7 since 3 October, 12 findings fixed, 2 new". A partial audit says so in the card. While an audit runs, the card shows its progress and a Stop button; a stalled or failed audit shows what went wrong and a button that runs it again.

Two views of the findings, each a table the server filters, sorts and pages from the URL, as Pages is:

- by finding: the check, its severity and area, how many pages fail it, the list of pages, what Google says with its link, how to fix it, and a button to mark it intended at the URL, selector or check grain
- by page: every finding of one URL, with the page's status, canonical, title and whether Citequill wrote it

A third card lists images grouped by `src`, because a logo repeats on 300 pages and is fixed once: the image, the alt as found (absent, empty and whitespace told apart), the pages, a CSS selector, a short HTML snippet, and the ancestor that decided the verdict, the link or the figure.

Every finding carries the page URL, the subject (an image `src`, a link `href`, a sitemap URL), a CSS selector built from id, classes and tag so the same element has the same selector on every page, and a short HTML snippet; the audit keeps no page HTML. A finding has a fingerprint, the hash of its check, page, subject and selector, so two audits can be compared: fixed is in the previous and not in the latest, new is in the latest and not in the previous, and a finding marked intended in between is neither. A finding on a page Citequill wrote is labelled so, because it is a regression test of Citequill's own writer and template on a real site.

A filter by language narrows every view to one locale; the score stays the site's.

The history lists every audit with its score, band and counters. The owner opens any of them; the comparison is between the last two, because only they keep their findings. Older audits keep their score and counters.

## The site's pages

The list of the site's URLs has one home, `site_pages`, which the connect crawl starts and every audit updates: URL, locale, status, final URL, whether the page is indexable, whether robots.txt kept the audit from fetching it, its canonical, its title, its click depth and inbound link count, when it was first and last seen, and whether Citequill wrote it. `crawled_pages` keeps the content the facts come from.

A row describes the URL's own answer. A URL that redirects has the status of its first hop, the next URL as its redirect and the end of the chain as its final URL, and is not indexable. A page is indexable when it answers 200, robots.txt does not block it, and neither its `robots` or `googlebot` meta tag nor an `X-Robots-Tag` line for Googlebot or for every crawler says `noindex` or `none`. Its locale is the locale whose base URL holds it, else its `<html lang>`. Citequill wrote it when a published page's computed path is its URL, with or without the trailing slash. A writer checking internal links reads `site_pages` and the project's published pages, and a link may point only at a page whose latest observation, by the crawl or an audit, says indexable, canonical and 200. An audit that read the whole site marks the pages it did not meet as gone, so they stop being link targets; a partial or stopped audit leaves the pages it did not reach as they were.

## Measurements

Every audit records what it cost to run: pages read, pages rendered, duration, sandbox CPU seconds and GB-hours, requests made, 429 and 5xx answers from the host, and the cost in dollars, from the unit prices in one place beside the model prices. The cost goes to the run's `cost_usd`, so the column means what the run cost Citequill. The first audit module doubles as the measurement spike: the first start time of the sandbox image, CPU seconds per rendered page, whether a detached process outlives the function that started it, and whether Cloudflare lets the bot through without the secret, all recorded in the research document and refreshed by every audit's own numbers.

## Delivery

The catalogue ships in slices, each a commit on `main` with its part of this document, in the order of the weights:

1. The crawl with its queue in the database, robots.txt, sitemaps, the indexability checks, the score, the report with its history, `site_pages`, the run's progress column, the bot page and the bot secret, and the render module in the sandbox as the measurement spike.
2. On-page and images.
3. Links.
4. HTTPS and mobile.
5. Performance.
6. Structured data and hreflang.
7. AI access, the GEO hints and the markdown hint.

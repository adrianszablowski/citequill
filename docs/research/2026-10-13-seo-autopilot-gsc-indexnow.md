# Search Console, IndexNow, sitemaps and AI features: facts for the SEO autopilot design

Research date: 13 October 2026. Every claim below has a URL. "Primary" means Google, Microsoft or indexnow.org wrote it. "Secondary" means a third party reported it. Items I could not confirm are flagged in the "Could not confirm" section at the end.

## Summary

- The Search Console API gives you query, page, country, device, date, hour and search appearance data, with generous quotas. It does not expose the new generative AI report. Google has not said whether it will.
- A service account added by the customer as a Search Console user avoids OAuth consent and app verification entirely. Google documents this pattern itself for the Indexing API.
- The URL Inspection API reads index status only. Nothing in the API requests indexing. The Indexing API is still limited to job postings and livestream videos.
- IndexNow lets you submit for any host that serves your key file. It reaches Bing, Yandex, Seznam, Naver, Yep, the Internet Archive and Amazonbot. Google is not a participant and has said nothing about it since its single statement in the year the protocol launched.
- Google gives no figure for how fast it picks up sitemap URLs. The only documented timings are "a few days to a few weeks" for a recrawl, and "several days to several months" in one AI doc.
- Google's recent guidance on AI Overviews and AI Mode says: standard SEO, unique non-commodity content, indexable pages with snippets allowed, no special files or markup. It explicitly warns that generating pages for every query variation "primarily to manipulate rankings or generative AI responses" violates the scaled content abuse policy. That warning matters for a product that generates pages weekly.

## 1. Google Search Console API

Units in the tables: QPS is queries per second, QPM is queries per minute, QPD is queries per day.

### 1.1 Search Analytics API

What it offers. Grouping dimensions are country, device, page, query, searchAppearance, date and hour. Search types are web, image, video, news, googleNews and discover. The API returns top rows by clicks, not all rows. With dataState set to all or hourly_all you get fresh but incomplete recent data, and the response marks where incomplete data starts.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Grouping dimensions | country, device, page, query, searchAppearance, date, hour | https://developers.google.com/webmaster-tools/v1/searchanalytics/query | Yes |
| Search types | web, image, video, news, googleNews, discover | same | Yes |
| rowLimit range | 1 to 25,000, default 1,000 | same | Yes |
| dataState values | final (default), all, hourly_all | same | Yes |
| Rows exposed per day per search type | maximum 50,000 | https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data | Yes |
| Hourly data window in the API | up to 10 days | https://developers.google.com/search/blog/2025/04/san-hourly-data (9 April 2025) | Yes |
| Hourly data window in the UI | last 24 hours, "a delay of only a few hours" | same | Yes |
| Daily data freshness | "collected data should be available in 2-3 days" | https://support.google.com/webmasters/answer/96568 | Yes |
| History in the report | 16 months | https://developers.google.com/search/blog/2018/01/introducing-new-search-console (January 2018) | Yes |
| History in the API | 16 months, announced by Google on Twitter on 18 June 2018 | https://searchengineland.com/google-search-console-analytics-api-now-has-16-months-of-data-300430 | No |
| Per-site quota | 1,200 QPM | https://developers.google.com/webmaster-tools/limits | Yes |
| Per-user quota | 1,200 QPM | same | Yes |
| Per-project quota | 30,000,000 QPD and 40,000 QPM | same | Yes |
| Other resources, per user | 20 QPS and 200 QPM | same | Yes |
| Other resources, per project | 100,000,000 QPD | same | Yes |

Freshness note. The daily freshness figure in the table is from the 'About Search Console data' help page, not the API reference. The API reference only says recent rows may be incomplete. Google's own how-to pseudocode queries the day given in the table below as the stable day.

Retention note. No current Google API page states the retention window. The Google post in the table states it for the report and says the API would follow. The API confirmation is a secondary report of a Google tweet. Treat the window as reliable in practice but not directly cited in current docs.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Stable day used in Google's own paging pseudocode | 3 days ago | https://developers.google.com/webmaster-tools/v1/how-tos/all-your-data | Yes |

### 1.2 Generative AI features in Search Console and the API

Google launched a dedicated Generative AI performance report this June and rolled it out to every site at the end of August. It reports impressions only. It covers AI Overviews and AI Mode on Search, with a separate report for Discover. It groups by pages, countries, devices and dates. It does not show queries, clicks, CTR or position. The report has an export button in the UI.

AI feature traffic has always been counted inside the Web search type of the main Performance report under standard rules. So the Search Analytics API already includes AI clicks and impressions mixed into web data, but it cannot separate them.

No Google page says the Search Analytics API or BigQuery bulk export exposes the generative AI report. The API reference lists searchAppearance as a dimension but never enumerates its values, and the help pages I checked do not list appearance values either, so I cannot say whether AI Overviews or AI Mode appear there. A third party re-tested in August and found neither the API nor the export exposes the report.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Generative AI report announced | 3 June 2026 | https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports | Yes |
| Rolled out to all sites | 31 August 2026 | same, and https://support.google.com/webmasters/answer/16984139 | Yes |
| Metrics in the report | impressions only | both | Yes |
| Dimensions | pages, countries, devices (Search only), dates | both | Yes |
| Date granularity | hourly, daily, weekly, monthly | both | Yes |
| Features covered (Search) | AI Overviews, AI Mode | https://support.google.com/webmasters/answer/16984139 | Yes |
| Queries dimension | not offered | same | Yes |
| Row limit in the report | 1,000 rows, same as Performance report | same | Yes |
| Search Labs experiments | excluded | same | Yes |
| AI Mode click counting | click on an external link counts as a click; standard impression rules; a follow-up question is a new query | https://support.google.com/webmasters/answer/7042828 | Yes |
| AI Overview position | one position for the whole overview; every link gets that position | same | Yes |
| Where AI traffic sits in the Performance report | Web search type | https://developers.google.com/search/docs/appearance/ai-features (updated 10 December 2025) | Yes |
| API or BigQuery exposure of the AI report | none found in Google docs; third party says not exposed as of 11 August 2026 | https://www.searchenginejournal.com/how-to-track-google-ai-mode-traffic-in-search-console/586194/ | No |
| New "Web: multimodal" search type in the UI | announced September 2026 | https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc | Yes |

I could not confirm whether the API `type` parameter accepts the new multimodal search type. The API reference still lists only the types in the first table.

### 1.3 Sitemaps API

A third party can submit a sitemap through the API if it has owner or full user access to the property. The method is a PUT with no body and an empty success response. The permissions table shows sitemap submission for owners and full users, not restricted users. Google does not state a per-call rate limit for sitemap submission beyond the "other resources" quota above.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Method | PUT https://www.googleapis.com/webmasters/v3/sites/siteUrl/sitemaps/feedpath | https://developers.google.com/webmaster-tools/v1/sitemaps/submit | Yes |
| Scope | https://www.googleapis.com/auth/webmasters | same | Yes |
| Who may submit a sitemap | owner, full user (not restricted user) | https://support.google.com/webmasters/answer/7687615 | Yes |
| Non-owner users per property | 100 | same | Yes |
| Delegated plus verified owners per property | 500 | same | Yes |
| Sitemap index files per site in Search Console | 500 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps | Yes |
| URLs per sitemap | 50,000 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | Yes |
| Size per sitemap, uncompressed | 50 MB | same | Yes |
| Sitemaps per index file | 50,000 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps | Yes |

### 1.4 URL Inspection API

It returns the indexed version's status only. You cannot test a live URL. The result includes a verdict, coverage state, robots.txt state, indexing state, last crawl time, page fetch state, Google-selected canonical, user-declared canonical, referring URLs, crawled-as device, mobile usability, rich results and AMP.

It cannot request indexing. The API reference index lists one URL Inspection method, index.inspect. Google's recrawl doc says requesting indexing happens in the URL Inspection tool, by an owner or full user, and that requesting a crawl does not guarantee inclusion.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Per-site quota | 2,000 QPD and 600 QPM | https://developers.google.com/webmaster-tools/limits | Yes |
| Per-project quota | 10,000,000 QPD and 15,000 QPM | same | Yes |
| Scopes | webmasters or webmasters.readonly | https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect | Yes |
| Index coverage | Google index version only, no live test | same | Yes |
| Methods in the URL Inspection service | 1 (index.inspect) | https://developers.google.com/webmaster-tools/v1/api_reference_index | Yes |
| Example result fields | verdict, coverageState, robotsTxtState, indexingState, lastCrawlTime, pageFetchState, googleCanonical, userCanonical, referringUrls, crawledAs, mobileUsabilityResult, richResultsResult | https://developers.google.com/search/blog/2022/01/url-inspection-api (31 January 2022) | Yes |
| Who can request indexing in the tool | owner or full user | https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl | Yes |

### 1.5 Indexing API

Still restricted. Google's quickstart says it can only be used for pages with JobPosting, or BroadcastEvent embedded in a VideoObject. I found no Google statement broadening it. Quota increases need an approval form and may go up or down "based on the document quality".

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Allowed content | JobPosting; BroadcastEvent in VideoObject | https://developers.google.com/search/apis/indexing-api/v3/quickstart | Yes |
| Default publish requests per day per project | 200 | https://developers.google.com/search/apis/indexing-api/v3/quota-pricing | Yes |
| getMetadata requests per minute per project | 180 | same | Yes |
| All endpoints per minute per project | 380 | same | Yes |
| Price | free | same | Yes |
| Scope | https://www.googleapis.com/auth/indexing | https://developers.google.com/identity/protocols/oauth2/scopes | Yes |

### 1.6 OAuth scopes, verification and the service account route

Scopes. The Search Console API uses `https://www.googleapis.com/auth/webmasters` ("View and manage Search Console data for your verified sites") and `https://www.googleapis.com/auth/webmasters.readonly` ("View Search Console data for your verified sites").

Sensitivity. Google does not publish a list of which scopes are sensitive. The Cloud Console shows the category automatically when you add a scope to a project. I could not confirm the webmasters scopes' category from any Google page. Plan for both cases. If they are sensitive, a public app needs sensitive scope verification before more than a small number of users can grant access. If they are not, only brand verification applies, and that is optional.

Verification. Google charges no fee. Two Google pages give different times for sensitive scope review. Verification is not required while the app is in Testing status with listed test users. Unverified apps face a lifetime cap on new users per project.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Sensitive scope review time | 3 to 5 business days | https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification | Yes |
| Sensitive scope review time (support table) | 10 business days | https://support.google.com/cloud/answer/13463817 | Yes |
| Brand verification time | 2 to 3 business days | same | Yes |
| Restricted scope verification time | 6 weeks | same | Yes |
| Fee from Google | none; third-party assessors charge for restricted scopes only | same | Yes |
| Unverified app user cap | 100 new users, lifetime per project | same, and https://support.google.com/cloud/answer/7454865 | Yes |
| Review requirements | justification per scope, unlisted YouTube demo video, privacy policy on the app's domain, domain verified in Search Console | https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification | Yes |

Service account route. Google documents it for the Indexing API: create a service account, then in Search Console "Add an owner" and "Provide your service account email as the delegated owner". The Search Console API works for any account with owner, full or read access. The permissions help says users must have a valid Google Account and that groups cannot be added. It does not mention service accounts by name, but the Indexing API prerequisites show Google treating a service account email as a valid user.

What this means for a hosted product. Each customer adds your one service account email as a full user (for sitemaps and URL inspection) or delegated owner. No consent screen, no scope verification, no token refresh. The customer must do that one step in Search Console. The per-property user caps in the Sitemaps API table are far above what this needs.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Service account as delegated owner | "Provide your service account email as the delegated owner" | https://developers.google.com/search/apis/indexing-api/v3/prereqs | Yes |
| API access requirement | owner, full or read access to the Search Console account | https://developers.google.com/webmaster-tools/about | Yes |
| Users must have | a valid Google Account; email groups cannot be added | https://support.google.com/webmasters/answer/7687615 | Yes |

## 2. IndexNow

### 2.1 How the key works

You generate a key and serve a UTF-8 text file named `{key}.txt` containing the key. The recommended place is the host root. You may instead place one or more key files elsewhere on the same host and pass `keyLocation` in each request. A key file's location limits which URLs it covers: URLs outside that path may not be considered. Requests name the host, and URLs that do not belong to that host are rejected with the error code shown in the table.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Key length | 8 to 128 characters | https://www.indexnow.org/documentation | Yes |
| Allowed characters | a to z, A to Z, 0 to 9, dash | same | Yes |
| Key file location | root, or anywhere on the same host with keyLocation | same | Yes |
| URLs per POST | 10,000 | same | Yes |
| Response 200 | received (not a promise to index) | same | Yes |
| Response 202 | received, key validation pending | same | Yes |
| Response 403 | key not valid | same | Yes |
| Response 422 | URL not on the host, or schema mismatch | same | Yes |
| Response 429 | too many requests, potential spam | same | Yes |
| Public daily rate limit | none disclosed; each engine sets its own per-site threshold | https://www.indexnow.org/faq | Yes |
| Wait before resubmitting the same URL | 5 minutes in one section, 10 minutes in another | same | Yes |
| Subdomains | each is a separate host with its own key file | same | Yes |

Note on the docs. The documentation calls the key "hexadecimal" but allows letters beyond a to f. Follow the character list, not the word.

### 2.2 Can a third party submit for a host it does not own

Yes in practice, provided the host serves the key file. The protocol proves ownership only by the key file. The FAQ says that when a CMS, hosting provider or SEO plugin supports IndexNow, submissions are handled automatically, and names Cloudflare as a native integration. The docs never address third-party submission in those words, and they say "Only you and the search engines should know the key and your file key location". For a Next.js site on Vercel the autopilot can ship the key file as a public asset or a route in the customer's deploy, which is exactly the hosting-provider pattern the FAQ describes.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Ownership proof | serve the key file from the host | https://www.indexnow.org/documentation | Yes |
| Platforms submitting on behalf of sites | CMS, hosting provider, SEO plugin, Cloudflare | https://www.indexnow.org/faq | Yes |
| Shared across engines | one submission reaches all participating engines | https://www.indexnow.org/documentation | Yes |

### 2.3 Which engines participate

The protocol's own registry lists the participants below. Several of the per-engine meta.json files did not load when I fetched them, so I confirmed the registry, not every endpoint.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Registry entries | bing, yandex, seznam, naver, yep, internetarchive, amazonbot | https://www.indexnow.org/searchengines.json | Yes |
| Engines named in the FAQ | Amazon, Bing, Naver, Seznam.cz, Yandex, Yep | https://www.indexnow.org/faq | Yes |
| Shared endpoint | https://api.indexnow.org/indexnow | same | Yes |

### 2.4 Google's stance

Google is not in the registry and no indexnow.org page mentions Google. I found no Google statement about IndexNow from the last two years. The only Google statement is the one in the table, when a spokesperson said Google would be "testing the potential benefits of this protocol". Google's current sitemap docs list Search Console, the API and robots.txt as the ways to submit URLs, and Google shut its own unauthenticated ping endpoint (date in section 3).

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Google statement | testing the protocol, 9 November 2021 | https://www.searchenginejournal.com/google-will-be-testing-indexnow/426602/ | No |
| Google statement in the last two years | none found | searches of Search Central blog and docs | not applicable |

### 2.5 Bing's own URL Submission API

Bing still runs a separate URL Submission API, but Microsoft now recommends IndexNow as the primary method. An update note on Bing's own blog posts says IndexNow is "the primary method for real-time URL submission" and the API "remains supported for advanced use cases". Microsoft Learn says the legacy SOAP and POX protocols retire on the date in the table and tells developers to migrate to its "REST APIs"; the same protocols page still documents JSON over HTTP at ssl.bing.com. I could not open the migration page it links to. The API key is per user, not per site, and only works for sites verified in that user's Bing Webmaster Tools account. That is the same delegation problem as Search Console.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| URLs per SubmitUrlBatch call | 500 | https://blogs.bing.com/webmaster/june-2019/bingbot-Series-Introducing-Batch-mode-for-Adaptive-URL-submission-API (12 June 2019) | Yes, dated |
| URLs per day per site | up to 10,000; actual quota based on verified site age, impressions and other signals | https://blogs.bing.com/webmaster/january-2019/bingbot-Series-Get-your-content-indexed-fast-by-now-submitting-up-to-10,000-URLs-per-day-to-Bing (31 January 2019) | Yes, dated |
| Quota allocation | at domain level, not per subdomain | same | Yes |
| Quota lookup | GetUrlSubmissionQuota API, or Submit URLs page | same | Yes |
| IndexNow recommendation | "Updated November 2025": IndexNow is the primary method | both Bing posts above | Yes |
| SOAP and POX retirement | 31 August 2026 | https://learn.microsoft.com/en-us/bingwebmaster/api-protocols | Yes |
| JSON endpoint format | https://ssl.bing.com/webmaster/api.svc/json/METHOD_NAME?apikey=API_KEY | same | Yes |
| API keys per user | 1, shared across all that user's verified sites | https://learn.microsoft.com/en-us/bingwebmaster/getting-access | Yes |
| Auth options | OAuth 2.0 (recommended) or API key | same | Yes |

The Microsoft Learn method reference pages for SubmitUrlBatch and GetUrlSubmissionQuota did not resolve at the URLs I tried. The per-call and per-day figures come from the dated Bing blog posts in the table. They carry a later update note but the numbers themselves are from the original posts.

## 3. Google's sitemap guidance and pickup speed

### 3.1 lastmod

Google uses lastmod as a signal for scheduling recrawls of URLs it already knows, when the value is "consistently and verifiably" accurate. The date must be in the sitemaps.org format. It should reflect the last significant change: primary text, structured data or links, not a footer or copyright year. If a CMS cannot know a page's real modification date, leave lastmod off for that page. If lastmod is routinely wrong, Google says it will stop trusting it. Google ignores changefreq and priority.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| lastmod use | crawl scheduling signal for previously discovered URLs | https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping (26 June 2023) | Yes |
| lastmod condition | "consistently and verifiably" accurate | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | Yes |
| changefreq and priority | ignored | both | Yes |
| Ping endpoint | deprecated 26 June 2023, stopped 6 months later, now returns 404 | https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping | Yes |
| Submission methods | Search Console, Search Console API, robots.txt Sitemap line | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | Yes |
| robots.txt pickup | "the next time we crawl your robots.txt file" | same | Yes |

### 3.2 Sitemap index files

An index file follows the same rules as a sitemap. Listed sitemaps must sit on the same host and in the same directory as the index or deeper. Cross-site sitemaps need every site verified in Search Console, and each per-site sitemap should hold only that site's URLs.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| loc entries per index | 50,000 | https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps | Yes |
| Index files per site in Search Console | 500 | same | Yes |
| Listed sitemap location | same host, same directory or deeper | same | Yes |
| Cross-site submission | verify ownership of every site | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | Yes |

### 3.3 How fast Google picks up new URLs

Google gives no figure for sitemap pickup speed. A sitemap is "merely a hint" and does not guarantee crawling or indexing. The Sitemaps report says Google recrawls a submitted sitemap "periodically" at a pace unrelated to the site crawl, and suggests resubmitting after big changes. The only timings Google publishes are for crawling in general.

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Crawl after a request | "a few days to a few weeks" | https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl | Yes |
| Recrawl after a preview-control change | "several days to several months" | https://developers.google.com/search/docs/appearance/ai-features | Yes |
| Sitemap recrawl cadence | periodic, unrelated to site crawl; retries "for a few days" if fetch fails | https://support.google.com/webmasters/answer/7451001 | Yes |
| Guarantee | none; a sitemap is a hint | https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap | Yes |
| Sites that may not need a sitemap | about 500 pages or fewer | https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview | Yes |

## 4. Google statements on AI Overviews and AI Mode in the last two years

Three primary sources, dated in the table at the end of this section. All say the same thing: optimise for Search and you have optimised for AI features.

### 4.1 The earlier blog post by John Mueller

Recommendations: make unique, non-commodity content; give a good page experience; meet the technical requirements (Googlebot not blocked, a success HTTP status, indexable content); use nosnippet, data-nosnippet, max-snippet or noindex to limit AI use, knowing that tighter controls reduce AI visibility; keep structured data matching visible content; add good images and video and keep Merchant Center and Business Profile current. Google claims clicks from pages with AI Overviews are higher quality, with no figures.

### 4.2 The AI features doc

A page is eligible for AI Overviews and AI Mode when it is indexed and eligible to show with a snippet. "There are no additional requirements", no special schema, no AI text files or markup. AI feature traffic is reported in the Performance report under the Web search type. Google-Extended controls training and grounding in other Google systems, not Search.

### 4.3 The recent blog post and the generative AI optimisation guide

Google published a dedicated guide this spring and updated it in the summer (dates in the table). New points beyond the earlier post:

- AI features use retrieval-augmented generation (grounding) on the normal Search index, plus "query fan-out": the model issues related queries and fetches more results
- "AEO" and "GEO" are "still SEO" from Google's view
- eligibility now also requires that the site is included in Search generative AI features in Search Console (sites can opt out there)
- a unique point of view and first-hand experience matter more than anything else in the guide
- creating separate pages for every query or fan-out variation "primarily to manipulate rankings or generative AI responses" violates the scaled content abuse spam policy, and "a high quantity of pages doesn't make a website higher quality"
- llms.txt and similar files are ignored by Google Search; they neither help nor harm
- no need to "chunk" content, rewrite for AI, or seek inauthentic mentions
- semantic HTML helps but is not required; follow JavaScript SEO practices; reduce duplicate content; Merchant Center and Business Profile feed AI responses for products and local businesses

| Fact | Value | Source | Primary? |
|---|---|---|---|
| Earlier post date | 21 May 2025 | https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search | Yes |
| AI features doc last update | 10 December 2025 | https://developers.google.com/search/docs/appearance/ai-features | Yes |
| Recent post date | 15 May 2026 | https://developers.google.com/search/blog/2026/05/a-new-resource-for-optimizing | Yes |
| Guide last update | 10 July 2026 | https://developers.google.com/search/docs/fundamentals/ai-optimization-guide | Yes |
| Eligibility | indexed, snippet-eligible, site included in generative AI features in Search Console | same | Yes |
| Special markup or files needed | none | same, and the AI features doc | Yes |

## Design implications

- Use a service account that each customer adds as a full user. It avoids OAuth verification and the unverified-app cap. Read-only data pulls, sitemap submission and URL inspection all work at full user level.
- Treat the Search Analytics API as the only programmatic AI signal: AI clicks are inside Web data but cannot be separated. Do not promise customers AI Overview or AI Mode reporting from the API.
- Budget URL Inspection at the per-site daily quota in the URL Inspection table. For a weekly batch of new pages that is ample, but do not poll every URL daily on large sites.
- For Google, discovery is sitemap plus accurate lastmod plus the Sitemaps API. There is no Google push channel for ordinary pages. Do not use the Indexing API for them.
- For Bing and the other IndexNow engines, ship the key file in the customer's deploy and submit through api.indexnow.org. Skip the Bing URL Submission API; Microsoft itself points to IndexNow.
- Weekly page generation must pass Google's own test in the current guide: unique point of view, non-commodity content, not one page per query variation. The guide names that pattern as scaled content abuse.

## Could not confirm

- Whether the webmasters and webmasters.readonly scopes are classed sensitive. Google publishes no list; the Cloud Console shows it per project.
- Whether the Search Analytics API or BigQuery export exposes the Generative AI report. No Google statement either way; a third party says no as of this August.
- Whether AI Overviews or AI Mode appear as searchAppearance values in the API. Google does not enumerate the values anywhere I could find.
- Whether the API `type` parameter accepts the new web multimodal search type.
- The retention window of the API from a current Google page. The Google post in the Search Analytics table covers the report; the API confirmation is a secondary report of a Google tweet.
- Any Google statement on IndexNow after the one in the table.
- The current Microsoft Learn reference pages for SubmitUrlBatch and GetUrlSubmissionQuota. The per-call and per-day figures are from Bing's dated posts.
- The per-engine IndexNow meta.json endpoints. The registry loaded; several individual endpoints did not at the time of fetching.
- Whether the "Only you and the search engines should know the key" line is meant to forbid a third-party service holding the key. The FAQ's hosting-provider wording suggests not.

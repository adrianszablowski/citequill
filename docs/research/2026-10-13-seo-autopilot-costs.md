# Cost research for a hosted SEO autopilot

Researched 13 October 2026. All prices in USD unless stated. "Vendor page" means the number comes from the vendor's own site. Third-party numbers are marked and should be rechecked before you budget on them.

## Summary

The variable cost per site is small and the LLM is most of it. Data and crawling are cents per article. Email is free at this volume. Fixed subscriptions (Ahrefs, Semrush, Exploding Topics, SerpApi plans) are the real cost and must be divided across customers.

| Volume per site | Variable cost per month | Of which LLM (Sonnet 5.5, standard) |
|---|---|---|
| 3 articles a week, English and Polish | $8.71 | $5.85 |
| 1 article a week, English and Polish | $2.90 | $1.95 |

Three things to know before you design:

- Google Trends now has an official API in alpha. Access is by application form, with no pricing stated
- Google Ads API developer tokens were sunset on 9 September 2026. Access is now per Google Cloud project, and keyword planning needs Basic access with brand verification
- Google's Imagen models are shut down. The Google image option is now the Gemini "Nano Banana" family

## 1. Keyword and SERP data

| Vendor | What | Price | Limits | Polish | Source | Vendor page | Flags |
|---|---|---|---|---|---|---|---|
| DataForSEO | Minimum deposit | $50 | Pay per use | Not confirmed on page | https://dataforseo.com/pricing | Yes | Endpoint pricing sub-pages return 404 |
| DataForSEO | Keywords Data API (Google Ads volume, ideas) | From $0.0012 per task | Up to 1,000 keywords per request (vendor, via search excerpt) | Not confirmed; Google Ads locations list has 94,933 entries | https://dataforseo.com/pricing and https://docs.dataforseo.com/v3/keywords_data/google_ads/locations/ | Yes | Third-party listing says live volume is $0.012 per task plus $0.00012 per keyword. Not confirmed |
| DataForSEO | DataForSEO Labs (keyword ideas, suggestions, related, bulk volume) | $0.012 per task plus $0.00012 per item | Per task plus per returned row | Not confirmed on page | https://dataforseo.com/pricing | Yes | |
| DataForSEO | Google SERP, per 10-result page | Standard $0.0006 ($0.60 per 1,000), priority $0.0012, live $0.002 ($2 per 1,000) | Standard about 5 min turnaround, live about 6 s | Not confirmed on page | https://dataforseo.com/apis/serp-api/google-serp-api | Yes | Autocomplete endpoint exists, price not shown |
| Google Ads API | Keyword Planner data (KeywordPlanIdeaService) | Free | Explorer: 2,880 ops/day, planning services blocked. Basic: 15,000 ops/day, needs brand verification. Standard: unlimited, 10 business day review | Not confirmed on a page I read | https://developers.google.com/google-ads/api/docs/access-levels | Yes | The language codes page is too large for the fetch tool, so the Polish row was not seen |
| Google Ads API | Access requirements | No developer token (sunset 9 Sept 2026), no manager account needed | Basic or Explorer applications were rejected for Free Trial or suspended billing accounts | | https://developers.google.com/google-ads/api/docs/get-started/dev-token | Yes | |
| Google Ads API | Exact volumes or ranges | Historical metrics are "approximate monthly search volume", up to 10,000 keywords per request, refreshed monthly | Spend is not mentioned on the API pages | | https://developers.google.com/google-ads/api/docs/keyword-planning/generate-historical-metrics | Yes | The "ranges unless you spend" rule comes from 2016 press (Search Engine Land), which I could not open. No current Google page confirmed it |
| SerpApi | Google search | Free 250 searches/mo. Starter $25 for 1,000 ($25 per 1,000). Developer $75 for 5,000 ($15). Production $150 for 15,000 ($10). Big Data $275 for 30,000 ($9.17) | Throughput per hour: 50 free, 200, 1,000, 3,000, 6,000 | Yes, gl=pl listed | https://serpapi.com/pricing and https://serpapi.com/google-countries | Yes | Speed add-ons multiply price 2x or 4x |
| SerpApi | Autocomplete, People Also Ask | Autocomplete is its own engine. PAA comes inside a normal search as related_questions | Cached searches are free | | https://serpapi.com/google-autocomplete-api and https://serpapi.com/related-questions | Yes | Pages do not state credit cost. One credit per call is inferred |
| Serper.dev | Google search credits | 2,500 free. $50 for 50,000 ($1.00 per 1,000). $375 for 500,000 ($0.75). $1,250 for 2.5 million ($0.50). $3,750 for 12.5 million ($0.30) | Credits expire after 6 months. 50 to 300 queries per second by tier | Not confirmed on vendor page | https://serper.dev/ | Yes | gl and hl parameters confirmed only by third parties. Third parties say 11 to 100 results cost 2 credits |
| Ahrefs | API v3 | Included on Lite and higher. Lite $129/mo, Standard $249/mo, Advanced $449/mo, Enterprise $1,499/mo (annual commitment) | Units per month: 200,000 Lite, 800,000 Standard, 2 million Advanced, custom Enterprise. Minimum 50 units per request | Not confirmed on page | https://ahrefs.com/pricing and https://help.ahrefs.com/en/articles/6559232-about-api-v3 | Yes | Search snippet of the help article says extra units are sold only on Enterprise. Not seen in the fetched text |
| Semrush | Standard API | Pricing page: Advanced $549/mo (monthly billing) includes "API data integration". Developer docs: API is an add-on to the Business tier | Units sold in packages of 2, 5, 10 or 20 million. Keyword overview 10 units per line, broad match 20, related keywords 40, keyword difficulty 50 | 142 geo databases. pl not confirmed | https://www.semrush.com/pricing/ and https://www.semrush.com/kb/5-api and https://developer.semrush.com/api/v3/analytics/keyword-reports/ | Yes | Sources conflict on the plan name. Unit package prices are not published |
| Keywords Everywhere | Credits (API included on all plans) | Credits page: $80 for 200,000 ($0.40 per 1,000), $150 for 500,000, $500 for 2 million. Pricing page: Bronze $84/year for 100,000, Silver $168 for 400,000, Gold $480 for 2 million | 1 credit per keyword. Up to 100 keywords per request. Credits last 1 year | Not confirmed. Countries endpoint lists them | https://keywordseverywhere.com/credits.html and https://keywordseverywhere.com/pricing.html and https://keywordseverywhere.com/api-documentation.html | Yes | The two vendor pages do not agree with each other. The credits page shows no currency symbol, so USD is assumed |

## 2. Trends and "what people ask"

| Vendor | What | Price | Limits | Source | Vendor page | Flags |
|---|---|---|---|---|---|---|
| Google | Google Trends API | Alpha, application form, no pricing stated | 1,800 days of history, daily to yearly aggregation, region filters, consistent scaling across requests (vendor, via search excerpt) | https://developers.google.com/search/apis/trends and https://developers.google.com/search/blog/2025/07/trends-api | Yes | Announced 24 July 2025. Still alpha on 13 October 2026 |
| SerpApi | Google Trends engine | Same plans as above (from $15 per 1,000 on Developer) | Up to 5 queries per interest-over-time call. Cache free for 1 hour | https://serpapi.com/google-trends-api | Yes | Credit cost per call inferred, not stated |
| Glimpse | Trends data and API | Not published. Third party reports $99/mo and a free plan of 10 searches | API key via meetglimpse.com/#api, limits on request | https://meetglimpse.com/google-trends-api/ | Yes (no prices) | Price is third-party only |
| Exploding Topics | Trends API | Add-on to Pro Business at $249/mo. API: 1,000 requests/mo $1,000, 5,000 for $2,000, 25,000 for $4,000 | 60 requests per minute. Commercial use (inside your product) needs custom pricing | https://explodingtopics.com/feature/et-api and https://explodingtopics.com/pro | Yes | Too expensive for this product unless shared across many sites |
| Reddit | Data API | Third parties: free 100 queries per minute per OAuth client for non-commercial use; $0.24 per 1,000 calls (2023 statement); commercial use needs an agreement | | https://octolens.com/blog/reddit-api-pricing | No | Reddit's own pages returned 403 or were blocked. Treat as unconfirmed |
| X | API, pay per use | Posts read $0.005 per resource. User read $0.010. Counts recent $0.005 per request. Post create $0.015 | Cap 3 million post reads per month. $20 free credit when you save a card | https://docs.x.com/x-api/getting-started/pricing | Yes | 1,000 posts read is $5. No search-posts line item |
| AlsoAsked | People Also Ask trees, API on all plans | Basic $12/mo for 100 credits. Lite $23 for 300. Pro $47 for 1,000 | All regions and all languages | https://alsoasked.com/pricing | Yes | Pay-as-you-go credit price not shown |

Free alternatives that work: People Also Ask arrives inside the SERP call you already pay for (SerpApi, Serper, DataForSEO). Autocomplete is a separate endpoint on all three, so it is one more call at the same per-search price. Together they cover "what people ask" for most niches at under $0.01 per query.

## 3. Crawling competitor and customer sites

| Vendor | What | Price | Limits | JS rendering | Source | Vendor page | Flags |
|---|---|---|---|---|---|---|---|
| Firecrawl | Credits | Free 1,000 credits. Hobby $19/mo (or $16 annual) for 5,000. Standard $83/mo annual for 100,000. Growth $333 for 500,000. Scale $599 for 1 million | 1 credit per page for scrape, crawl or map. Search 2 credits per 10 results. JSON extraction adds 4 credits per page. Concurrency 2, 5, 25, 50, 100 browsers. Rate limits 10, 100, 500, 5,000, 10,000 scrapes per minute | Yes, "JavaScript rendering, and dynamic content" | https://www.firecrawl.dev/pricing and https://docs.firecrawl.dev/introduction | Yes | Monthly billing price for Standard and above not shown. Enhanced proxies cost 1 credit, same as basic. robots.txt handling not stated. The pricing page contained text addressed to AI agents, which I ignored |
| Firecrawl | Pay as you go top-up | $5 increments: 1,000 credits on Hobby, 2,000 Standard, 2,500 Growth, 5,000 Scale | Paid plans only | | https://www.firecrawl.dev/pricing | Yes | Works out at $0.005 to $0.001 per page |
| Jina Reader | r.jina.ai | New keys include 10 million free tokens. Billed on output tokens | 20 requests per minute with no key, 500 with a key, 5,000 premium | Yes, headless browser by default | https://jina.ai/reader/ and https://jina.ai/api-dashboard/pricing/ | Yes | Top-up price ($50 per 1 billion tokens) is third-party only. The 10 million free tokens is vendor-stated. The claim that free tokens are non-commercial only is third-party |
| Apify | Platform | Free $5/mo of usage. Starter $19/mo. Scale $199. Compute unit $0.20 (pricing page) or $0.25 (actor page) | Website Content Crawler: about $0.50 to $5 per 1,000 pages with a browser, about $0.20 with raw HTTP | Yes (Playwright mode) | https://apify.com/pricing and https://apify.com/apify/website-content-crawler | Yes | Two vendor pages give different compute unit prices |
| Crawl4AI | Open source | Free, Apache 2.0. Cloud: 2,000 free credits, paid from $10, soft launch | Needs Playwright and your own server | Yes | https://github.com/unclecode/crawl4ai | Yes | Cloud prices "can change" |
| Vercel | Running Playwright in a function | Bundle 250 MB uncompressed by default. Large functions beta up to 5 GB with fluid compute. Max duration 300 s Hobby, 800 s Pro, 1,800 s beta | Vercel's guide uses puppeteer-core plus @sparticuz/chromium-min | | https://vercel.com/docs/functions/limitations and https://vercel.com/guides/deploying-puppeteer-with-nextjs-on-vercel | Yes | Feasible but fragile. A hosted crawler is simpler for a weekly batch |

Robots.txt etiquette, from Google and RFC 9309 (both official):

- robots.txt is advisory. Google says compliance depends on each crawler choosing to follow it, so you must build the check yourself
- match your own user agent token, fall back to the * group, apply the most specific rule, and allow when rules tie
- cache a site's robots.txt for no more than 24 hours
- treat a 5xx on robots.txt as "disallow everything", and a 4xx as "no restrictions"
- crawl-delay is not part of the standard, so honour it if present but set your own rate cap as well

Sources: https://developers.google.com/search/docs/crawling-indexing/robots/intro and https://www.rfc-editor.org/rfc/rfc9309.html. Practical additions: send a named user agent with a contact URL, crawl a few dozen pages per competitor per week not the whole site, and never fetch pages behind a login.

## 4. LLM cost

Prices from https://platform.claude.com/docs/en/about-claude/pricing (vendor page). Batch API is 50% off input and output. Prompt cache writes cost 1.25x (5 minute) or 2x (1 hour) the input price. Cache reads cost 0.05x on Opus 5.5 and Sonnet 5.5, 0.025x on Fable 5.1, 0.1x on Haiku 5.5.

| Model | Input per million | Output per million | Cache read per million | Batch input | Batch output |
|---|---|---|---|---|---|
| Claude Fable 5.1 | $10 | $50 | $0.25 | $5 | $25 |
| Claude Opus 5.5 | $4 | $20 | $0.20 | $2 | $10 |
| Claude Sonnet 5.5 | $2 | $10 | $0.10 | $1 | $5 |
| Claude Haiku 5.5, prompts up to 100,000 tokens | $0.10 | $0.50 | $0.01 | $0.05 | $0.25 |
| Claude Haiku 5.5, prompts over 100,000 tokens | $0.50 | $2.50 | $0.05 | $0.25 | $1.25 |

The web search tool costs $10 per 1,000 searches on top of the tokens its results add; a search that errors is not billed, and the count comes back in `usage.server_tool_use.web_search_requests` (https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool, vendor page, checked 17 October 2026).

Worked estimate for one 2,500-word article: research, draft, fact-check pass and Polish translation, 150,000 input tokens and 15,000 output tokens in total across several calls. The caching column assumes half the input tokens are served as cache reads and ignores the cache write premium.

| Model | Standard | With 50% cache reads | Batch API | Batch plus cache |
|---|---|---|---|---|
| Fable 5.1 | $2.25 | $1.52 | $1.13 | $0.76 |
| Opus 5.5 | $0.90 | $0.62 | $0.45 | $0.31 |
| Sonnet 5.5 | $0.45 | $0.31 | $0.23 | $0.15 |
| Haiku 5.5, each prompt under 100,000 tokens | $0.023 | $0.016 | $0.011 | $0.008 |
| Haiku 5.5, if prompts exceed 100,000 tokens | $0.11 | $0.08 | $0.06 | $0.04 |

Two cautions. The pricing page says models from Claude 4.7 onwards use a tokeniser that produces about 30% more tokens for the same text, so 150,000 may be low for pipelines measured on older models. Haiku 5.5 is priced per prompt, so keep each call under 100,000 tokens to stay on the cheap tier.

## 5. Hero images

| Vendor | Model | Price per image | Source | Vendor page | Flags |
|---|---|---|---|---|---|
| OpenAI | GPT Image 2, 1024x1024 | Low $0.006, medium $0.053, high $0.211 | https://developers.openai.com/api/docs/guides/image-generation | Yes | GPT Image 2.5 is priced per token only ($30 per million image output tokens) |
| OpenAI | GPT Image 1 Mini, 1024x1024 | Low $0.005, medium $0.011, high $0.036 | https://developers.openai.com/api/docs/guides/image-generation | Yes | |
| Google | Gemini Nano Banana 2.1 | 1K $0.0336, 2K $0.0504, 4K $0.113. Batch halves this | https://ai.google.dev/gemini-api/docs/pricing | Yes | |
| Google | Gemini 3.1 Flash Image (Nano Banana 2) | 1K $0.067, 2K $0.101 | https://ai.google.dev/gemini-api/docs/pricing | Yes | |
| Google | Gemini 3 Pro Image (Nano Banana Pro) | 1K or 2K $0.134, 4K $0.24 | https://ai.google.dev/gemini-api/docs/pricing | Yes | |
| Google | Imagen 3 and 4 | Shut down | https://ai.google.dev/gemini-api/docs/imagen | Yes | "Imagen models are shut down". Gemini 2.5 Flash Image was scheduled to shut down on 2 October 2026 |
| Replicate | Flux schnell | $3 per 1,000 images ($0.003) | https://replicate.com/pricing | Yes | |
| Replicate | Flux dev | $0.025 | https://replicate.com/pricing | Yes | |
| Replicate | Flux 1.1 pro | $0.04 | https://replicate.com/pricing | Yes | Flux 2 pro price not on the model page. Third parties give $0.015 to $0.055 |
| fal.ai | Flux schnell | $0.003 per megapixel, rounded up. About $0.003 per 1024x1024 image | https://fal.ai/models/fal-ai/flux/schnell | Yes | fal's Flux 2 pro page treats 1024x1024 as one megapixel. Strict rounding of 1.05 megapixels would give $0.006 |
| fal.ai | Flux 1.1 pro | $0.04 per megapixel, rounded up | https://fal.ai/models/fal-ai/flux-pro/v1.1 | Yes | |
| fal.ai | Flux 2 pro | $0.03 first megapixel, $0.015 each extra. 1920x1080 is $0.045 | https://fal.ai/models/fal-ai/flux-2-pro | Yes | |

Is skipping images reasonable? For web search rankings, yes. Google's image documentation makes no claim that images raise a page's web ranking. It says sharp images "can increase traffic" through Google Images and that Discover prefers images at least 1,200 px wide with max-image-preview:large, which are "more likely to generate visits from Discover" (https://developers.google.com/search/docs/appearance/google-images and https://developers.google.com/search/docs/appearance/google-discover, both vendor pages). The often-quoted Backlinko finding that pages with at least one image outperform pages without is from a 2016 study. The current page at https://backlinko.com/search-engine-ranking no longer carries that claim. A cheap middle path is a templated SVG or OG image rendered by your own code at no API cost, which satisfies social previews and the Discover size rule.

## 6. Email for weekly reports

| Plan | Price | Volume | Limits | Source | Vendor page |
|---|---|---|---|---|---|
| Resend Free | $0 | 3,000 emails/mo | 100 per day, 3 domains, 30-day retention | https://resend.com/pricing | Yes |
| Resend Pro | $20/mo | 50,000 emails/mo | No daily cap, 10 domains. Overage $0.90 per 1,000 | https://resend.com/pricing | Yes |
| Resend Pro | $35/mo | 100,000 emails/mo | Same | https://resend.com/pricing | Yes |

One weekly report per site is 4.33 emails a month. The free plan covers about 690 sites. The 100 per day cap bites first if all reports go out the same morning.

## 7. Monthly cost per customer site

Assumptions, per article (one article means one topic published in English and in Polish, with the translation inside the LLM budget):

- 6 SERP calls on Serper at $1 per 1,000 (3 per language), $0.006
- 2 DataForSEO Labs keyword tasks returning 100 rows each, $0.012 plus $0.012 each, $0.048
- 2 Google Ads search volume tasks at $0.0012, $0.0024
- 30 pages crawled on Firecrawl (20 competitor, 10 customer) at 1 credit each. Hobby is $0.0038 per credit, Standard $0.00083
- 1 LLM run on Sonnet 5.5 standard at $0.45, or $0.23 on Batch
- 1 optional hero image at about $0.05 (GPT Image 2 medium or Nano Banana 2 1K)
- 1 report email a week, on the Resend free plan
- a month is 4.33 weeks, so 3 a week is 13 articles and 1 a week is 4.33 articles

| Line | 3 articles a week (13/mo) | 1 article a week (4.33/mo) | Notes |
|---|---|---|---|
| Data (SERP plus keywords) | $0.73 | $0.24 | $0.056 per article. One Trends call per article fits in SerpApi's 250 free searches for up to about 19 sites at 3 a week |
| Crawling, Firecrawl Hobby | $1.48 | $0.49 | Falls to $0.32 and $0.11 on Standard |
| LLM, Sonnet 5.5 standard | $5.85 | $1.95 | Batch halves this to $2.93 and $0.97. Opus 5.5 doubles it to $11.70 and $3.90 |
| Images, optional | $0.65 | $0.22 | $0 if you skip them or render an SVG |
| Email | $0 | $0 | Free plan up to about 690 sites |
| Total, variable | $8.71 | $2.90 | $8.06 and $2.68 without images |

Fixed costs to divide by the number of sites:

| Item | Monthly | Why it is fixed |
|---|---|---|
| Firecrawl Hobby | $19 | 5,000 credits covers about 12 sites at 3 articles a week, 166 articles |
| Serper starter pack | $50 once per 6 months | 50,000 queries lasts about 6 months for 100 sites at 3 a week, which matches the credit expiry |
| DataForSEO deposit | $50 minimum | Pay per use after that |
| SerpApi (if used for Trends) | $0 to $25 | Free plan is 250 searches, Starter $25 |
| Ahrefs Lite (optional) | $129 | 200,000 API units shared |
| Semrush Advanced (optional) | $549 | Plus unpublished unit packages |
| Exploding Topics (optional) | $1,249 | $249 plan plus $1,000 API tier |

## What I could not confirm

- DataForSEO per-endpoint prices for Google Ads volume. Sub-pages return 404. Only the "from" prices on the main pricing page are vendor-confirmed
- Polish coverage on a vendor page for Google Ads API, DataForSEO, Serper, Ahrefs, Semrush and Keywords Everywhere. Confirmed only for SerpApi (gl=pl) and AlsoAsked ("all regions, all languages"). DataForSEO's volume endpoint is Google Ads data, so it inherits whatever Google covers
- Reddit API prices. Reddit's pages were blocked. All figures are third-party
- Jina token top-up prices, Glimpse plan price, Replicate Flux 2 pro, Serper gl and hl support. Third-party only
- SerpApi credit cost for Trends and Autocomplete calls. Inferred as one search each
- The Google Keyword Planner "ranges for low spenders" rule. No current Google page states it
- Conflicts between vendor pages: Keywords Everywhere credits page vs pricing page, Apify $0.20 vs $0.25 per compute unit, Semrush Business vs Advanced as the API plan, Firecrawl 1 credit for enhanced proxies vs no stealth figure

# Cogny and the AI visibility trackers: what they do, what they cost, how they onboard

Research date: 16 October 2026. Prompted by the owner finding Cogny and asking why it is cheap. Grades as in the 13 October competitor doc: A GitHub API or first-person postmortem; B independent hands-on test; C vendor page; D Trustpilot or review aggregator; E competitor comparison or directory; F HN or Product Hunt comment.

## The short answer

Cogny is not an autopilot writer. It is an analysis layer over marketing data the customer already has (Search Console, GA4, ads, CRM), driven through Claude or any MCP client, and every write waits for approval. It is cheap at $9 a month because that plan includes zero AI credits: the customer's own Claude subscription pays for the thinking. Our model is the mirror image. We run Opus and Sonnet on our own key, so our cost per run is ours.

Three product categories now sit next to each other and a flat comparison would mislead:

- analysis layers over existing data: Cogny
- autopilot writers: RankYak, ContentMonk, Hypertxt and the rest of the 13 October list
- prompt-based AI visibility trackers: Peec, Profound, Otterly, Scrunch, Rankscale

Citequill spans the first two and touches the third. Only step 1 of the MVP exists in code today; every Citequill cell below that is not sign-in and projects describes `product.md`, not shipped behaviour.

## Cogny in detail

Source: cogny.com home, pricing, docs, comparison and blog pages, all grade C unless noted.

| Aspect                  | What Cogny says                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Positioning             | "Every marketing channel, connected, analysed and automated by AI." Solo for operators and vibe coders, Cloud for teams                                                                               |
| How you use it          | Claude Desktop, Claude Code, Cursor or the `cogny` CLI through an MCP endpoint, or the built-in chat on paid plans                                                                                     |
| Data in                 | OAuth: Search Console, GA4, Tag Manager, Google, Meta, LinkedIn, TikTok and other ads, HubSpot, Supabase, GitHub. API keys: Bing Webmaster, Semrush, Ahrefs, Plausible, Fathom, Klaviyo and about 20 more |
| CMS                     | WordPress, Webflow, Framer, Sanity, Ghost, Contentful with keys or tokens. What each can write is not stated                                                                                          |
| SEO work                | reads Search Console daily, finds pages ranking 4 to 10 with low CTR, proposes rewritten titles and meta descriptions, content gap pages, structured data patches, redirect chains                     |
| GEO work                | uses Bing Webmaster Tools AI citation metrics as a proxy. AI citation tracking and LLM visibility audit are marked "coming soon"                                                                       |
| Content writer          | blog posts, landing pages, pillar and product pages from GA4, Search Console and ads data plus brand context. Where it publishes, whether it schedules, and languages: not stated                      |
| Unit of work            | the ticket. Each shipped change is measured 3 days later for ads, 7 days later for content and SEO, then closed as worked, partial, did not work or inconclusive                                      |
| Recurring work          | a loop: a chat you liked, repeated on a schedule. Each run becomes a ticket                                                                                                                             |
| Approval                | reads run on their own, writes ask first unless a tool is set to always allow. Code changes arrive as a pull request                                                                                   |
| What it does not do     | its own words: no backlinks, no keyword volume or difficulty, no independent crawl, no history beyond the 16 months Search Console keeps                                                              |
| Who it does not fit     | a site with an empty Search Console. "The tool that reads it cannot help you yet" (OctoLoops competitor page, E, and consistent with Cogny's own docs)                                                |

### Cogny pricing

| Plan      | Price a month | AI credits          | Notes                                                                                   |
| --------- | ------------- | ------------------- | --------------------------------------------------------------------------------------- |
| Free      | $0            | 50 chat credits once | 15 MCP calls a month, no card; OctoLoops quoted 10 credits in August                     |
| Solo      | $9            | 0                   | unmetered MCP calls under fair use, dashboard, loops. "Solo's $9 includes no AI credits" |
| Cogny AI  | $18           | 150                 | built-in chat                                                                           |
| Cogny Pro | $90           | 1,500               |                                                                                         |
| Cloud     | $499          | 5,000               | BigQuery warehouse, scheduled reports, daily briefs, team workspace, onboarding call; the content writer page says 2,000 credits |

Fair use means "standard tool calls from your own agent, which pays for its own AI thinking". Image generation, media analysis and web search draw credits. Out of credits, things pause; no surprise charges. Cloud is listed as $499 on the pricing page and $530 on the Ahrefs comparison page and in its schema markup. SourceForge shows 3.5 of 5 from 2 reviews, one complaining that chat needs separate credits after upgrading (D).

What this means for us: Cogny's price is low because its marginal cost is near zero. Ours is an Opus call per page. When pricing comes, the choice is between pricing per page or run like RankYak at $99 a site, bring your own key like Hypertxt, or the Cogny route of letting the customer's agent do the work through an MCP server. That is a question for the owner, not a plan.

### Cogny onboarding

Solo: sign up free, connect one channel (Search Console is enough for SEO), ask a question. Claimed 5 minutes (C). Cloud: about an hour with whoever holds tool access, in 8 steps: connect data sources, review 3 generated context documents ("roughly right, not exactly right"), name 2 to 5 core metrics, turn on 3 or 4 reports, review the first 20 tickets, connect the repository, add loops (C).

The pattern worth keeping: the machine writes the company context from data, the human corrects it, and a wrong fact there "carries into every report". That is our product skill.

## Autopilot writers: one onboarding compared

RankYak is the closest in shape to our steps 2 and 3. Its help centre is offline as of today, so the flow below comes from G2 and directory summaries (E).

| Step                     | RankYak                                                              | Citequill (`product.md` step 2)                                                           |
| ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Enter                    | site URL, optional CMS, optional Search Console                      | domain                                                                                    |
| Machine does             | scans the site, finds keyword opportunities, writes the first article | crawls up to 50 pages, reads locales, extracts facts, writes the product skill, 3 kinds   |
| Human reviews            | the content plan, then articles                                      | the product skill, then fills in what the crawl could not                                 |
| First visible result     | one article, right after the scan                                    | a skill to read                                                                           |
| Ongoing rhythm           | one keyword a day on a calendar, rebuilt monthly, swap any day       | `pagesPerWeek` per locale, Monday 06:00 UTC                                               |
| Review mode              | autopilot once connected, edit anything                              | drafts by default, auto per project                                                        |

The difference that matters for the first session: RankYak ends onboarding with a page, we end it with a document. Edge case 14 in the 13 October doc already named this: "the value signal arrives after the trial".

## Prompt-based AI visibility trackers

These tools run a list of prompts against ChatGPT, Perplexity, Google AI Overviews and others on a schedule and report whether the brand is mentioned or cited. The prompt list is the product and the cost driver. Prices from otterly.ai's own comparison page and two aggregator posts (E), vendor pages where checked (C).

| Tool                  | Entry price a month   | Prompts at entry | Engines      | Onboarding                                                                                           |
| --------------------- | --------------------- | ---------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| Otterly               | $29 Lite, $189 Standard | 15, 100          | 4            | define scope, pick prompts and competitors; G2 lists "easy setup" (D)                               |
| Peec AI               | $95 Starter           | 50               | 3 on Pro     | domain in, brand profile extracted, a review step before topics, prompts suggested from the profile (C) |
| Promptwatch           | $99 per site          | 50               | not stated   | not checked                                                                                          |
| Semrush AI Visibility | $99 per domain        | 25               | not stated   | not checked                                                                                          |
| Profound              | $99 ChatGPT only, $399 Growth | 100 on Growth | 3 on Growth | enterprise-led, annual contract (E)                                                                  |
| Writesonic GEO        | $249                  | 100              | not stated   | not checked; bundles writing tools                                                                   |
| Scrunch AI            | $300, $250 annual     | 350              | not stated   | 3 seats, SOC 2 (C)                                                                                   |
| Rankscale             | $20 for 120 credits   | credit per run   | varies       | heavy daily tracking exhausts the base tier (E)                                                      |
| Sorank                | $99 per site          | bundled          | not stated   | connect site, audit, then articles, backlinks, fixes and AI mention tracking together (E)             |

Peec's onboarding is the one to copy and it is already our design: the domain produces a profile (company name, description, industry, products, personas, target market), the user corrects it, and every edit refreshes the suggested prompts. Peec's docs promised first data within 24 hours in a page that now returns 404; treat the figure as unconfirmed.

## Three levels of GEO measurement, and what each costs us

The owner asked how to track GEO. There are three levels and they stack:

| Level | What it measures                                                                       | Source                                              | Cost to us                                        | Where it is in our docs                           |
| ----- | -------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| 1     | real visits from AI assistants to the customer's site                                  | our script, the `ai` referrer group                 | none beyond the script                            | `analytics.md`, MVP step 5                        |
| 2     | pages Bing and its AI partners cite, impressions in Copilot                            | Bing Webmaster Tools, the one official free source  | one more connector like Search Console            | not in the MVP; Cogny uses exactly this as its GEO |
| 3     | whether the brand appears when a model answers a chosen prompt                         | running prompts against the models ourselves        | per prompt per engine per day; this is why trackers cost $95 to $400 | backlog in `decisions.md`, "visibility in AI answers" |

Level 1 is the only one that measures outcome rather than exposure, and no competitor in the tables above has it, because none of them owns the analytics script. Level 3 is where the trackers spend their money and where the owner would spend ours.

## A normal day in each category

The owner asked above all about the work, so here is what the human does once a site is connected:

- Cogny: open the graph start page, read the next step a chat proposes, approve or reject tickets. Nothing ships without that click, and the ticket closes itself 7 days later with a result.
- RankYak: look at a calendar with one article a day. Swap a keyword or let it publish.
- prompt trackers: read a dashboard, add or prune prompts. There is no content work at all.
- Citequill as `product.md` describes it: once a week, open Pages, read the drafts, click Publish. In auto mode, read the report and nothing else.

Our loop is already the shortest in the writer category because the unit is a week, not a day. What it lacks against Cogny is the close: a published page never reports back on its own. Options 2 and 3 below are about that.

## Options for the owner

Each option names the MVP step it would change. None is decided.

1. Step 2 also leaves one draft page. After the crawl writes the product skill, the same Workflow writes one page from the best starter kind, so the first session shows a page, not only a document. Cost: one Opus page per connection.
2. Step 5 shows the `ai` group first. The Analytics tab opens on sources with the `ai` row at the top, so GEO is visible from the first visit even at zero. This is a layout decision inside what `analytics.md` already describes.
3. Step 7 measures per page. Every published page gets a row in the report 7 days later: clicks, impressions, position from Search Console, visits by referrer group from the script. Cogny's "ticket closed as worked or not" without the ticket.
4. Bing Webmaster Tools as a second connector, after step 6. Same shape as Search Console: the owner adds our service account or key, a daily fetch saves rows. Gives level 2 GEO for free. Backlog candidate, not MVP.
5. Prompt tracking stays in the backlog. Level 3 costs real money per project per day and the trackers above already sell it. Revisit when levels 1 and 2 show that AI traffic exists for a project.
6. Pricing model. The Cogny route means exposing an MCP server so the customer's agent writes pages with the customer's tokens. It would cut our cost to near zero and change what Citequill is. Worth a grilling round before any pricing work, not before.

## Sources

- Cogny: https://cogny.com/, https://cogny.com/pricing, https://cogny.com/ai-seo-geo-optimization, https://cogny.com/ai-content-writer, https://cogny.com/comparisons/cogny-vs-traditional-seo-tools, https://cogny.com/docs/integration-catalog-and-setup-guides, https://cogny.com/docs/cloud-setup-guide, https://cogny.com/blog/one-cogny-for-every-plan (C)
- OctoLoops on Cogny: https://octoloops.com/compare/cogny-alternative (E)
- SourceForge Cogny reviews: https://sourceforge.net/software/product/Cogny/ (D)
- Peec AI docs: https://docs.peec.ai/project-profile (C); quick start page returned 404 on the research date
- RankYak: https://www.g2.com/products/rankyak/reviews, https://topai.tools/t/rankyak (E); help centre redirected to help.center on the research date
- Tracker pricing: https://otterly.ai/alternatives/pricing/ (C for Otterly, E for the rest), https://canlah.ai/blog/ai-visibility-tool-pricing-2026/, https://www.get-ryze.ai/blog/ai-visibility-tools-pricing-compared-2026 (E)
- Sorank: https://saascity.io/blog/sorank-review-2026, https://nl.trustpilot.com/review/sorank.com (E, D)

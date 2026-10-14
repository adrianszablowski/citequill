# Autopilot SEO content products: landscape, complaints and edge cases

Research date: 13 October 2026. Digest of a sub-agent report. Grades: A GitHub API or first-person postmortem; B independent hands-on test; C vendor page; D Trustpilot; E competitor comparison or directory; F HN or Product Hunt comment.

## The short answer

No active product does what we describe. Autopilot tools publish through CMS plugins, webhooks or a hosted blog. Repo and PR publishing exists only for SEO fixes (SEOmatic, Vaza, Ahrefs Agent A, Agent Sean) or as open-source projects with 0 to 23 stars. SEOLint, the one GitHub App for SEO, shut down in July 2026 without leaving beta. No maintained Next.js npm package for autopilot content exists (nxtblog-ai: 3 stars, last push February 2025; seobot-nextjs-blog: 54 stars, read-only client). Subpath hosting via rewrite is done by Superblog and Quillly, both hosting products.

Only Superblog and seo-agent-kit advertise IndexNow on publish. None of the autopilots do.

## Landscape (entry prices)

| Product | Integration | Entry price | GSC | Review | Notes |
| --- | --- | --- | --- | --- | --- |
| RankYak | WordPress, Wix, Shopify, Webflow, REST, MCP, webhooks | $99 per site | rising queries to articles, Site Guard flags cannibalisation | drafts or auto | refreshes existing articles |
| RankPill | WordPress plugin | $99 | not confirmed | editable | Trustpilot 2.8/5, 53% one-star |
| RankPine | many CMS, webhook, Strapi, Hashnode | $99, 30 articles, +$15 per language | GSC plus SERPs | autopilot default | 100 backlink credits |
| ContentMonk | GSC, GA, WordPress, Webflow, REST, MCP | $99 | daily | drafts queued | rewrites pages losing rankings; tracks AI prompts |
| Byword | WordPress, CSV | $99 for 25 | indexing tools | you publish | programmatic templates |
| Arvow (ex Journalist AI) | many CMS | $39, 1,000 credits | not stated | not stated | credits per action; G2 1.5/5 |
| BlogBuster | WordPress, Webflow, Shopify, API, hosting | $9.49 yearly | no | drafts or auto | cheapest |
| Hypertxt | WordPress, Ghost, webhooks, CLI, MCP | $19 for 10 | optional, near-ranking topics | every draft reviewed | GEO focus, BYOK $89 |
| Ranked.ai | hosted CMS, managed | $99 per site | yes | managed | serves .md pages and llms.txt |
| Superblog | hosting, subpath via rewrites | $29 to $99 | no | you write | IndexNow on publish |
| Quillly | WordPress, Ghost, Shopify, reverse proxy, MCP 62 tools | $19 to $229 | GSC and Bing | draft default | clean text copies for AI crawlers |
| Sorank | CMS, MCP | $99 per site | yes | ? | GEO tracking bundled |
| Machined | CMS | free 5, $19 for 30 | no | ? | cluster-first |

Repo and PR tools: SEOmatic ($99, PR per batch, refuses default branch, new pages only on Markdown blogs, no MDX body edits), Vaza (edits metadata, sitemap, robots, JSON-LD; 30-day PR mode then direct commits; runs next build in a sandbox and rolls back), Agent Sean (open source, 2 new pages a day cap, refuses YMYL and unbounded city x service pages, snapshot and revert), DIY GitHub Actions pipeline by jrbayguade (7 Claude agents, weekly cron PR, about $1.36 to $1.50 per article).

## Complaints, grouped

- Quality: Outrank 60-day test: 9 of 60 articles live with zero edits, 12 needed heavy rewrites (B, https://aboahreviews.com/outrank-so-review/). "generic, shallow" (RankPill, D). "word salad" (SEObot, E).
- Hallucinated product claims: no review documents it, but the GitHub Actions author added anti-fabrication rules after the writer invented first-person anecdotes (A); seo-agent-kit rejects a post after 2 failed rewrites against facts.json (A, https://github.com/kevinbadi/seo-agent-kit); Outrank mentions the product "in ways that feel repetitive" (B).
- Cannibalisation: 7 near-duplicate topics in 60 articles (B); Schenk: thin content "competed with itself", only 6% of pages with impressions got clicks (A).
- Formatting: AI-looking images, link rot, YouTube embeds swapped 1 in 5, MDX inline CTA wrapped in block p (F, B, A).
- Slugs: WordPress drops colons; a greedy regex skipped diagrams silently (A).
- Traffic loss: Tailride, Schenk (A); GSQi August 2026 spam update: programmatic plus AI site lost 200,000+ queries (B, https://www.gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/); Outrank user: impressions dropped after automated publishing (D).
- Cost and billing: the biggest category. No cancel button (Outrank), discount not honoured and $137 after a "free" trial (RankPill), $708 annual rebill (Journalist AI), cancel flow built to earn one more month (BabyLoveGrowth), trial branding on live articles (Outrank $1 trial).
- Support: Outrank replies to 17% of negative reviews, 10.5-day average.
- Non-English: Slovak with foreign words (RankPill), Spanish stiff and formal (Outrank), Catalan literal translations (A), English posts published on a Spanish-only site (Schenk). Nothing independent on Polish.

## Gaps users want

Editing and refreshing existing pages; approval by default and a calendar; stronger topic dedupe; keyword data and competitor monitoring; owner-controlled pillars or prompt; programmatic pages from the customer's data; free tools and calculators (no hosted autopilot builds them); changelog to post (none); GEO tracking; reporting that shows value inside the trial (SEOLint died because its grade arrived after 14 days against a 7-day trial); easier cancellation.

## Pricing models

Dominant founder tier: $99 per site with 20 to 30 articles. Credits are the complaint. Nobody offers unlimited autopilot pages per site under $1,000. BYOK exists (Hypertxt $89 one-time).

## Open source worth reading

| Repo | Stars | What |
| --- | --- | --- |
| AgriciDaniel/claude-seo | 18,856 | audit skill suite for Claude Code |
| AgriciDaniel/claude-blog | 2,379 | writing suite, cannibalisation skill, Next.js MDX |
| Illyism/seo-skills | 70 | daily autopilot agent: articles, comparison pages, free tools, diff-marketing from commits |
| dqhieu/gsc-seo-autopilot | 23 | Claude Code skill: GSC quick wins, 7 posts per run |
| kevinbadi/seo-agent-kit | 22 | facts.json gate, WordPress publish, IndexNow, nightly reweighting from GSC |
| goldk3y/agentblog | 10 | Next.js 16 blog with JSON-LD, IndexNow, writing skill that never invents a figure |
| seziro-team/agentsean | 1 | 425 checks, PRs, 2 pages a day cap, YMYL refusal |

## 15 edge cases to design for

1. Auto-publish with no human read is the root cause both postmortems name. Default to a review window; make auto-publish explicit per site.
2. The pause setting is easy to miss. Show state in the weekly email.
3. Near-duplicate topics. Check each topic against existing URLs and GSC queries before writing.
4. Wrong language on a single-language site. Enforce the locale list at the publish gate.
5. Non-English drafts read stiff or contain foreign words. Native-language check.
6. The writer invents anecdotes, figures and product details. Gate claims against site facts; reject after N rewrites.
7. MDX or build breaks. Prefer new files over editing bodies; build before publish when touching a repo.
8. Silent step failures. Fail loudly; email on every agent error.
9. Never commit to the default branch (if ever touching a repo).
10. Cap volume per day; refuse unbounded templates and YMYL niches.
11. Links rot and embeds point at competitors. Check outbound links on publish and on a schedule.
12. Impressions can drop after automated publishing starts. Track from day one; auto-pause on a defined drop.
13. Billing is the biggest complaint. Cancel in the app, email before every charge, content stays with the customer.
14. The value signal arrives after the trial. Show something concrete in the first session.
15. Rewrites fail on some hosts; catch-all routes shadow /blog.

# Decision log

Each entry: date, decision, reason. New entries go at the top. A decision stands until a newer entry changes it.

## 2026-10-14: the name Citequill

The product is called Citequill. The domains citequill.com, .io, .ai, .dev and .pl, the npm package name and the GitHub account were free on 14 October 2026. Trade mark registers were not checked.

Reason: "cite" names the GEO goal (being cited by AI assistants), "quill" names writing. The only sensible name with a free .com. Rejected: serpmill (sounds like a content mill), rankwright (an SEO agency in Canada), rankloop (an existing rank tracker).

## 2026-10-14: what Citequill is

A hosted SEO and GEO autopilot. The owner connects a site, Citequill does research every week, writes pages and publishes them to the customer's site through an integration. The owner gets a report and does not have to do anything day to day.

Repo: Next.js 16.4 on Vercel, pnpm, TypeScript, App Router. The repo is private, `docs/` lives in the repo.

## 2026-10-14: decisions from grilling round 1

1. A dashboard with login. One workspace per connected project. In the workspace, tabs: pages (under the URL the owner points to), analytics from Search Console (positions, impressions, clicks per page, model: Atomic AGI), skills. The owner chooses per project: full auto mode or drafts mode, in which nothing goes out without their click.
2. No weekly page limit. The owner is responsible for their domain. Citequill is responsible for the quality of every page.
3. Skills as the source of truth. After connecting, Citequill crawls the site and writes the first skill: what the product is about, who it is for, what features it has, languages. The owner corrects the skill and adds more (how to write blogs, what not to claim). The model uses only skills as knowledge about the product. The page author is a field in the product skill.
4. Page kinds in the MVP: blog posts, guides, comparisons with competitors. Outside the MVP: calculators, free tools, "X for Y" pages.
5. Trackist: Citequill adds new pages next to the existing ones in TypeScript arrays. No migration.
6. Backlinks: backlog. SEObot exchanges links between customers with their consent; this needs a separate decision.
7. Languages: Citequill reads from the customer's site which languages it exists in, and writes in those languages.
8. MVP scope: only the owner's projects, no payments and plans. Payments and plans come once the product meets the owner's expectations on their sites.
9. No "prepared with the help of AI" note. The byline is the author given in the skill.
10. A week of work is counted as a Workflow on Vercel with steps that call the model API directly.
11. Search Console: the owner adds the Citequill service account address as a full user of the property. No OAuth.

Reason: the owner's answers to round 1, 14 October 2026. The research behind the questions lives in `research/`.

## 2026-10-14: React Compiler and typed routes enabled

`next.config.ts` has `reactCompiler: true` and `typedRoutes: true` next to `cacheComponents` and `partialPrefetching`. We write components without `useMemo`, `useCallback` and `React.memo`; the compiler memoises on its own. `href` in `<Link>` and `redirect()` is checked by TypeScript, so a typo in a path fails on `pnpm type-check`.

Reason: the owner's decision after the report on Next.js 16.4. Both options have been stable since 16.0. The Rust version of the compiler (`experimental.turbopackRustReactCompiler`) stays off while it is experimental.

## 2026-10-14: platform vision, the MVP stays with content

In the end Citequill is one place to run your own sites and apps: SEO and GEO content, your own live traffic analytics (who visited, from where, from which country, as in DataFast), AI visibility (who cites you, for what), without paying external tools. The MVP builds only the first part: research, writing and publishing pages, and a dashboard with data from Search Console. Live analytics and AI visibility go to the backlog.

Reason: content is faster to build and gives the result the owner wants to check on their sites first. Google Analytics is enough until then. Search Console updates its data with a delay of days, which is annoying, but in the MVP it is the only source of positions and clicks.

## 2026-10-14: decisions from grilling round 2

1. Build order: login and user → projects (one project is one site) → Next.js integration → writing → publishing → Search Console → report. Next.js first, because all of the owner's sites run on Next.js.
2. Database: Supabase, Postgres. Types from `supabase gen types`, access only from the server.
3. Login: Supabase Auth through Google. In the MVP, a list of allowed email addresses in `ALLOWED_EMAILS`.
4. Skills: a `skills` table, each row belongs to one project, projects are independent of each other. A skill is markdown with `name` and `description` frontmatter, like SKILL.md in Claude Code, edited in a text field in the dashboard.
5. Web research: the web search tool in the Anthropic API, to be checked in practice. Exa as plan B.
6. Crawling the customer's site: our own fetch (sitemap, HTML to markdown, `llms.txt` and markdown feeds where they exist). Firecrawl when we meet a site rendered in the browser.
7. Many languages: each language version is written separately from the same brief, published together with a slug mapping for hreflang.
8. Dashboard UI: shadcn/ui on Tailwind 4.

Reason: the owner's answers to round 2, 14 October 2026. Open after the round: how content gets to the customer's site, the model provider, the number of pages per week, images.

## 2026-10-14: decisions from grilling round 3

1. Citequill is a headless CMS for the content it writes itself. Three layers: a Content API (JSON over HTTP, a key per site), adapters per framework, push connectors to third-party CMSs. In the MVP only the Content API exists. The Trackist landing page reads it with a plain `fetch` inside `'use cache'`; the `@citequill/next` package will be made by extracting that code when a second site is connected.
2. Models: Opus 5.5 writes pages and the report, Sonnet 5.5 extracts facts from the crawl and classifies. Haiku is outside the MVP, because the owner has had bad experiences with it.
3. Number of pages: a project setting `pagesPerWeek`, counted per language, default 3. The owner changes it freely; it is a default value, not a product limit.
4. Images: none in the MVP.

Reason: the owner's answers to round 3, 14 October 2026.

## 2026-10-14: we design Citequill for every site, not for the owner's sites

The owner's sites are the first customers, nothing more. Every decision about the product, API, analytics and dashboard passes a test: would a shop on Shopify, a SaaS on Astro, a blog on WordPress and a site in plain HTML benefit from it without changes on our side. The Content API, webhooks and IndexNow assume only a domain and an HTTP request. "Because that is how it is on the owner's sites" is not a justification.

Reason: the owner, rounds 4 and 8. Opening to other customers should need as few changes as possible, and the edge cases of other kinds of sites should be visible from the start.

## 2026-10-14: decisions from grilling round 4

1. One new Supabase project for all of Citequill, separate from the Trackist database. A `project_id` column separates projects.
2. Content API at version `v1`, the site key in an `Authorization: Bearer` header. A list of pages with cursor pagination and an `updatedSince` filter, a single page by slug, a list of redirects, sitemap entries. Responses with `ETag`. A page carries everything the customer's site needs for full SEO and GEO without its own logic: the full path, kind, locale, translations for hreflang, meta, canonical, content, FAQ, author, publication and update dates, tags, sources from research, related pages for internal linking and ready JSON-LD.
3. A URL prefix per page kind in the project settings. From it Citequill works out the full path of every page.
4. Change notification: a webhook from the project settings, a `POST` with a signed payload (event, path, slug) after publishing, updating and unpublishing. What the customer does with it is their business: revalidation, a deploy hook, nothing. Optional; without a webhook the customer polls the API and relies on cache headers.
5. IndexNow: Citequill generates a key per project and shows in the dashboard which file to place on the domain. It pings only once it has checked that the file responds. Without the file, the sitemap remains.
6. Page states: `draft`, `published`, `unpublished`. An unpublished page disappears from the list and from the sitemap. When unpublishing, the owner chooses: 410 or a 301 redirect to a given address, because the page may already have been linked to. The list of redirects is in the API.
7. Page on demand: a button in the dashboard with a topic and a kind runs the same workflow without the topic selection step.

Reason: the owner's answers to round 4, 14 October 2026.

## 2026-10-14: decisions from grilling round 5

1. Content in the API in two forms: markdown as the source of truth and HTML rendered by us at publication with the same renderer, with heading identifiers and FAQ anchors.
2. Authors (name, title, profile URL) and organisation (name, URL, logo) are fields in the project settings. The product skill says which author writes which kind and in what tone. This changes point 3 from round 1: the author is no longer a field in the skill.
3. A page kind is a project row: name, URL prefix and a kind skill describing how to write such a page. A new project gets three starter kinds with skills: blog, guide, comparison. The code does not know kinds by name.
4. Each project locale has its own base URL (origin and an optional prefix). The full path of a page is the locale's base URL plus the kind prefix plus the slug. The crawl fills in the addresses from `hreflang`.
5. No domain ownership verification in the MVP.
6. Refreshing existing pages is outside the MVP.

Project settings split into required and optional. Required are only those without which a page cannot be written and published: address, locales, kinds, author. Webhook, IndexNow, domain verification and Search Console are optional; whoever sets them gets more, whoever does not gets a working product.

Reason: the owner's answers to round 5, 14 October 2026.

## 2026-10-15: decisions from grilling round 6

1. Steps of the weekly run: context (skills, existing pages, Search Console where present) → topic research and selection of `pagesPerWeek` topics with a justification → a brief per topic → writing each language version → the check of product claims against the skills → publication or draft. A page that fails the check after one correction stays a draft with a note, also in auto mode. Opus 5.5 writes, Sonnet 5.5 checks.
2. No emails in the MVP: the weekly report and drafts are visible only in the dashboard.
3. External links to sources in the content: an optional project setting, on by default.
4. No spend limit in the MVP. Tokens and the cost of every run are counted from day one and visible in the report.

Reason: the owner's answers to round 6, 15 October 2026. Open: the scope of data from Search Console, inputs to research.

## 2026-10-15: our own traffic analytics enters the MVP, Search Console is optional

Traffic data and search engine data are two different sets. Traffic on the site (visits, path, referrer including AI domains, country, UTM) is measured by Citequill's own script on the customer's site and is visible live. Queries, impressions and positions in Google come only from Search Console, with a delay of 2 to 3 days. This is how DataFast works: its own live script plus an optional Search Console integration.

1. The build order from round 2 changes: step 5 is the analytics script and the live tab, step 6 is the optional Search Console integration, step 7 the report.
2. The script: a small JavaScript in the `<head>` of the customer's site, sends events to a Citequill endpoint. No cookies and no identifier in the browser; a visitor is counted with a daily hash of IP, user agent and a salt changed every day. Country from Vercel's geolocation header on the endpoint.
3. Events live in Supabase, a table partitioned by month. A columnar database in the backlog with a threshold.
4. Search Console: a daily pull of yesterday's data into our database (query, page, country, clicks, impressions, position); the dashboard and the report read from the database. Queries from Search Console are an input to research only in projects that have connected it.
5. Inputs to research in the MVP: skills, existing pages from the crawl, web search, queries from Search Console where present, an optional list of competitors in the project. No paid keyword tools.

Reason: the owner wants to see the effect live, and Search Console does not give that. Round 7, 15 October 2026. Repeals the backlog entry about live analytics.

## 2026-10-15: decisions from grilling round 8

1. The live analytics tab: people on the site now, visits and visitors over time, most visited pages, referrers in groups (search engines, AI, social, other sites, direct), countries, UTM, a "Citequill pages only" filter, a date range.
2. The weekly report: a page in the dashboard, one per week per project, written by Opus. It contains the published pages with links, drafts with the reason, traffic to Citequill pages by source, data from Search Console when connected, the cost of the run in tokens and dollars.
3. The dashboard: a list of projects, and in a project the tabs Pages, Skills, Analytics, Reports, Settings. "Write a page" in Pages, the auto/drafts switch in Settings.
4. The domain citequill.com was bought on 15 October 2026. The analytics script and the Content API live under it from the first deployment.

5. Custom events in the MVP: one function in the script, the events table has a column for the event name and room for an amount and a currency from day one, the dashboard shows events next to visits and by source. Revenue from payment integrations is in the backlog.

Reason: the owner's answers to round 8, 15 October 2026.

## 2026-10-15: product documentation and two clarifications

The decisions from eight rounds are written up as a product description in `product.md`, `data-model.md`, `skills.md`, `workflow.md`, `content-api.md` and `analytics.md`. From now on those documents describe the state, and this log says only why.

Two clarifications made while writing:

1. The default mode of a new project is drafts. The owner switches on auto mode when they have seen the quality of the pages.
2. The author is a field of the page kind (`page_kinds.author_id`), not a sentence in the product skill. The skill speaks about tone; who signs which kind is data, like the authors and organisation from round 5.

Reason: drafts mode cannot break anything on the customer's site, and the author as a field does not need markdown parsing at every publication.

## 2026-10-15: the git convention is a rule, and Matt Pocock's skills have configuration

1. `docs/git.md` moves to `.claude/rules/git.md` with `paths:` for git files and the commit hook. The owner's decision: the convention for working with the repo is a rule for the agent, and `docs/` describes the product.
2. The skills from the mattpocock-skills plugin read `docs/agents/`: issues in this repo's GitHub Issues through `gh`, five default triage labels, one domain context. The files stay in `docs/`, where the skills expect them; `.claude/agents/` is reserved by Claude Code for subagent definitions.
3. The decision log replaces `docs/adr/`. `docs/agents/domain.md` points the skills here, so a second log does not appear.
4. The "Agent skills" block sits in `AGENTS.md`, not in `CLAUDE.md`, because `CLAUDE.md` is a single line `@AGENTS.md`.
5. Everything in the repo is in English: docs, this log, research notes, rules, skills, comments, commit messages. The owner is spoken to in Polish. Until this date `docs/` was in Polish; it was translated in one pass.

Reason: the owner's instruction of 15 October 2026; two instruction files and two decision logs are two sources of truth, and one language in the repo means the skills, the rules and the docs quote each other without translation.

## 2026-10-15: the UI stack is shadcn on Base UI, and a form is React Hook Form with Zod

1. `shadcn init` ran with the CLI's current defaults for an existing Next.js project: Base UI primitives (`@base-ui/react`, the default since July 2026), the `nova` style, base color `neutral`, CSS variables, Lucide icons. `components.json` records this; `style` and `baseColor` cannot change after init. The `shadcn` package is a runtime dependency because `globals.css` imports `shadcn/tailwind.css`.
2. A form is `useForm` from `react-hook-form` with a Zod 4 schema through `zodResolver` from `@hookform/resolvers/zod`, rendered with `Controller` and the shadcn `Field` family, as the shadcn forms documentation shows. Neither library ships an ESLint plugin; a form with `useForm` and `Controller` passed the gate, including the React Compiler rules bundled in `eslint-config-next`, on 15 October 2026.
3. `components/ui/` is written by `shadcn add`. Its files export several named components, so the one-component-per-file rule stops at that directory. After every `shadcn add`, `pnpm lint:fix` brings the files to the repo's format.
4. `prettier-plugin-tailwindcss` sorts classes, as Tailwind's documentation recommends, also inside `cn` and `cva` calls. `tailwindStylesheet` points at `app/globals.css` because Tailwind 4 has no config file.
5. `lib/utils.ts` is a one-line re-export of `cn` from the `cn` package, not a helper of ours, so Vitest waits for the first helper with logic in `lib/`.
6. Dark mode is the `.dark` class on `html`, as shadcn generates it, in place of the scaffold's `prefers-color-scheme` query. Nothing toggles it yet.
7. Geist stays wired through `--font-geist-sans` and `--font-geist-mono` in `layout.tsx`; init had rewritten `--font-sans` to reference itself, which left the page without a font.
8. A Tailwind class is canonical. The owner saw `suggestCanonicalClasses` warnings from the Tailwind IntelliSense extension; `eslint-plugin-better-tailwindcss` ships the same check as `enforce-canonical-classes`, built on Tailwind's own `canonicalizeCandidates`, so the gate enforces it instead of the editor. Only that one rule of the plugin is on; `rootFontSize: 16` lets pixel values map to the spacing scale. The scaffold page and `field.tsx` were rewritten by `pnpm lint:fix`.

Reason: the owner asked, on 15 October 2026, to install the libraries by their documentation with their full configuration before step 1 of `product.md`. The CLI defaults are the documented path and leave the fewest choices to revisit; React Hook Form with Zod is the combination shadcn documents for its `Field` components and the one the owner named. A warning only the editor shows is a rule with no checker; the lint rule is the same logic in the gate.

## Backlog

Things put off for later, with a date and a reason.

- 2026-10-14: backlinks and link exchange between customers. Google's policy calls exchanges link spam; needs a separate decision.
- 2026-10-14: calculators, free tools, "X for Y" pages. They need their own data or code in the feed.
- 2026-10-15: a columnar database for events (ClickHouse, Tinybird). When a month of events exceeds tens of millions of rows or the tab's queries stop fitting in a second.
- 2026-10-15: a paid tool for keyword volumes. When Search Console shows that the chosen topics bring no impressions.
- 2026-10-14: AI visibility: for which questions and phrases assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot) mention or cite the customer's site, in which position, next to which competitors; tracked over time like positions in Google. Tools exist that do this; Citequill should have it. After the MVP.
- 2026-10-14: the `@citequill/next` package and push connectors (WordPress, Webflow, Ghost, GitHub). After the first post on Trackist through the Content API.
- 2026-10-14: images in pages (generated or stock). They need hosting, licences and a field in the feed.
- 2026-10-14: domain ownership verification (a file or a TXT record in DNS). Matters before opening to other users; a separate step, because IndexNow is optional and not everyone will turn it on.
- 2026-10-14: refreshing existing pages based on Search Console, new data and changes in skills. After the Search Console tab.
- 2026-10-15: emails: the weekly report and a notification about new drafts (Resend). After the MVP.
- 2026-10-15: a monthly spend limit per project that stops the run. Before payments.
- 2026-10-15: revenue in analytics: webhooks from Stripe, LemonSqueezy, Paddle, Polar, Shopify, attributing a payment to a visitor and a source, a report on "how much the Citequill pages earned". When the first customer with online payments asks for it; the columns for amount and currency already exist.
- 2026-10-14: payments and plans. After the product meets the owner's expectations on their sites.

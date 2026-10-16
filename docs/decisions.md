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

## 2026-10-15: step 1 signs in through Supabase Auth with Google and keeps projects behind RLS

1. Sign-in starts in a server action: `signInWithOAuth` on the server client from `@supabase/ssr`, PKCE flow, `redirectTo` built from `NEXT_PUBLIC_APP_URL` plus `/auth/callback`, where the code is exchanged for a session. No Supabase client runs in the browser. The URL and the publishable key keep the `NEXT_PUBLIC_` prefix the library documents.
2. `proxy.ts` refreshes the session with `getClaims()` on every request and sends a visitor without a session to `/login`; it decides nothing else, as the Next.js authentication guide asks of an optimistic check. `ALLOWED_EMAILS` is checked in two places that matter: the callback signs out an address off the list right after the exchange, and `getCurrentUser()` in `lib/auth.ts` repeats the check in every section and server action that reads user data. An address removed from the list loses access on its next request.
3. A table or column enters the migration of the step that first reads it. Step 1 creates `projects` with `id`, `user_id`, `name`, `domain` and `created_at`, with row level security and two policies on `(select auth.uid())`. `user_id` references `auth.users`; the `users` table in `data-model.md` waits for a reader.
4. Migrations live in `supabase/migrations/` and go up with `supabase db push --linked`. The CLI mints a temporary login role through the Management API, so the database password stays in the owner's password manager. `pnpm db:types` regenerates `lib/types/database.ts` from the linked project and formats it with Prettier; the generated file passes the gate as is, so it has no exemption.
5. A project is created with a name and a domain. The domain is required because a project is one site; step 2 crawls the domain that is already there.
6. `isAllowedEmail` is the first helper with logic in `lib/`, so Vitest arrives: `vitest.config.ts` maps `@/`, a test sits beside its module, `pnpm test` runs inside `verify`.
7. Environment: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_EMAILS`. The secret key arrives with the first code that reads it.

Reason: the owner created the Supabase project and the Google OAuth client on 15 October 2026 and asked for step 1. The server-only flow keeps "access only from the server" from `data-model.md` literal. RLS is the check closest to the data; the proxy cannot be, because it runs on prefetches too. A migration per step keeps the schema and the code that reads it in one commit.

## 2026-10-16: the dashboard is a sidebar layout, and sign-in by email waits

- The dashboard takes the structure of the shadcn dashboard block: a project switcher at the top of the sidebar, the five sections of the current project in the middle, the user at the bottom, and a header with the page title over the content. The tabs under the project name are gone.
- The five sections, their icons and the page title derived from a path live in `lib/sections.ts`; the list of the user's projects in `getProjectList()` in `features/projects/queries.ts`, wrapped in React `cache` because the sidebar and the project list read it in the same request.
- `createClient()` in `lib/supabase/server.ts` starts with `connection()`. With Partial Prefetching, `cookies()` keeps the caller inside the prerendered app shell, and the auth client's `Date.now()` there is a prerender error that the dev overlay reports on a signed-in reload.
- Sign-in by email goes to the backlog. Google is enough for the owner.
- The sign-in page is a card with one button, Continue with Google, with the Google logo, taller than the default button.
- Reason: the owner wants the panel to look like a product dashboard from step 1, with a structure that carries every later section without a redesign.

## 2026-10-16: one component per file, with no private exception

- A file holds one component, `export default`, named after the file. A section behind `<Suspense>`, a loader that reads data for a client component, an error line: each is its own file. A `page.tsx` or `layout.tsx` holds only the route component.
- `components/ui/` stays as the CLI writes it, with several components per file.
- Reason: the owner's rule. One name per file makes a component findable from its name alone and keeps a route file a route file.

## 2026-10-16: code lives by domain in `features/`, and `app/` holds only routes

- `features/<domain>/` holds `actions.ts`, `queries.ts`, `schema.ts` and `components/` of one domain. Today: `auth` (sign-in, sign-out, the current user, the allowlist, the user menu) and `projects` (create, list, the form, the switcher, the header). An action is named after what it mutates, never after the page that calls it.
- `components/` keeps only the shell shared by every domain: the sidebar, the header, the page title, the section nav. SVG icons go to `components/icons/`, one per file. `components/ui/` stays the CLI's.
- `lib/` keeps only what crosses domains: the Supabase clients, the sections, `utils.ts`.
- `getCurrentUser()` is wrapped in React `cache`, so the sidebar, the project list and the header share one session read per request.
- Reason: the Next.js docs are unopinionated but every example names the action file after its domain, and the newest guide uses `features/<domain>/`. Actions placed by route scatter one domain across pages as soon as two pages mutate it; the research is in `docs/research/2026-10-16-nextjs-actions-file-structure.md`. The owner chose this option.

## 2026-10-16: the dashboard is always one project, and a site is connected before it opens

- There is no list of projects and no Projects entry in the sidebar. Projects are switched only in the switcher at the top of the sidebar, under the logo and the name Citequill. The root address sends the user to their first project.
- A user without a project lands on the connect page and gives one thing: the domain. In step 2 the crawl runs there, before the dashboard opens. The same page adds every later site. The project's name is its domain until the crawl names it after the site.
- Reason: the owner's call. Whoever is inside the dashboard has already chosen a project, and the whole dashboard changes per project, so a project list is a screen with no job. A first-time user with an empty dashboard would see nothing Citequill can do; the crawl is what makes the panel worth opening.

## 2026-10-16: copy has a skill and a facts rule, the root is a landing page, and waiting shows

- `/copy` in `.claude/skills/copy/` holds the rules for every line a person reads. Its facts rule: a line in the UI describes only behaviour whose MVP step is done; the docs describe the whole MVP, so the step list decides. Each claim gets a verdict (verified, narrowed, not yet, no code), the shape of Trackist's `verify-app-claims` skill. The voice rules come from the reelcaption copy skill, cut to what Citequill has, plus the signs of machine writing Wikipedia's AI Cleanup project lists and NN/g's guidance on errors and empty states; the sources are in `research.md` beside the skill.
- The root address is the landing page, inside the `(marketing)` route group, with the product's one-sentence definition and a Sign in link until the owner writes it. `/projects` is the signed-in home that sends the user to their first project or to the connect page. The proxy sends a signed-in visitor from `/` to `/projects`; `/login` is left alone, because `getCurrentUser()` sends an address that left the allowlist there and a redirect back would loop.
- The connect page takes the site's address as a URL or a domain and keeps the host without `www.`, so one site is one project whichever form the user pastes. The crawl in step 2 finds whether the site answers with `www` or without and keeps that as the locale's base URL. The project's name on the dashboard is the switcher's first line, with Citequill under it, so the open project is the first thing in the sidebar; the header under it is gone, because the name was the domain shown twice. The sidebar collapses to a rail of icons, the shape of the shadcn sidebar-07 block, so the sections stay one click away on a narrow window.
- Every button that waits on the server shows a spinner and a pending label: `useFormStatus` for the Google and sign-out buttons, `useTransition` for the sign-out menu item, which stays open while it waits, `useLinkStatus` for sidebar links with a fixed-size hint toggled by opacity. The connect button stays pending after the action redirects, because the action settles without a value before the new page is on screen.
- Reason: the owner wants copy that promises nothing the product does not do, written in plain language, and feedback on every click.

## 2026-10-16: the crawl is a Workflow and a run, and the dashboard waits for the product skill

- The crawl on connection runs as a Vercel Workflow, as `workflow.md` planned for every process that calls the model. A spike confirmed it under `next dev` with the Local World, started from a server action, with `withWorkflow()` beside Cache Components, the React Compiler and typed routes, and a 200 KB step result. The Local World keeps its data in `.workflow-data/`, which is git-ignored, and the proxy matcher skips `.well-known/workflow/`. `withWorkflow()` writes its route handlers into `app/.well-known/workflow/` with their own `.gitignore`; ESLint and Prettier skip that directory, like `.next/`, because the gate checks code we write.
- The crawl is a `runs` row with `trigger` `crawl`. `workflow.md` already says every model call adds its cost to its run and `data-model.md` that the run is the only place the cost is read from, so the crawl's two model calls land there too, and the run's `status` and `error` are the crawl state the progress page shows. No second table for crawl state.
- Workflow steps write with the Supabase secret key through `createAdminClient()` in `lib/supabase/admin.ts`, because a Workflow has no user session and row level security would refuse it. The user-facing code keeps the cookie client; the secret key never reaches a route a user can call.
- A skill is edited as three fields, name, description and body, which are its three columns; the frontmatter is rendered only when the skill goes into a prompt. One text field holding frontmatter and body would need a parser and a format error the owner can hit.
- The crawl runs again only on request, from the progress page after a failure or from Settings, and leaves skills, kinds and authors alone, so the owner's edits survive. Settings stays read-only in this step: it shows what the crawl found, marks what is not set yet, and an edit form comes with the step that needs it.
- Reason: the fewest moving parts that still meet the step 2 criterion, and nothing a later step has to undo.

## 2026-10-16: the crawl ranks pages, reads signals and extracts facts in parallel chunks

- Every request of the crawl goes through `fetchPublic()` in `features/crawl/fetch.ts`: the host's addresses are resolved and refused when private, loopback, link-local, carrier-grade NAT or cloud metadata, redirects are followed by hand with the same check on every hop, one time limit covers the hops and the body is cut at 2 MB. The check happens before the request, so a DNS answer that changes between the check and the connection could still point inside; accepted for now, because the crawl reads one site it was told to read and the fix (pinning the connection to the checked address) needs a custom dispatcher. Sitemaps are read only from the site's own host.
- The order of the 50 pages is a ranking, not the sitemap's order: home, then the links of the home page's header, navigation and footer, then paths that name a page carrying facts in the common European languages and English, then the rest by depth with a sample of five blog posts. Archives, pagination, account pages and files are dropped, and pages under another locale's prefix go last. The navigation links come first because they are the site's own list of its important pages and work in any language; the word list is a second signal, never the only one. Links found on fetched pages join the candidates, so a site without a sitemap is read beyond its home page.
- The crawl saves the page's signals beside the body in `crawled_pages.signals`: description, Open Graph, canonical, JSON-LD about the organisation, products, offers, questions and people, email and phone links, social profiles and the footer text. They are exact where prose is not, and they reach the extractor beside the body. Tables stay tables in the markdown (`turndown-plugin-gfm`), because prices live in them. Hidden elements are removed before the text reaches a model.
- Facts are extracted per chunk of about 60 000 characters, in parallel, and merged by text before Opus writes the skill. One call over 300 000 characters lost detail; many small calls keep it, and a chunk that fails retries alone. The schema has fourteen groups, so a plan limit, a job title or a certificate has a place; `other` catches what fits nowhere.
- Usage is added to the run through the SQL function `add_run_usage`, which adds in place, because parallel chunks reading and writing the sums would lose updates; only the service role may call it.
- The product skill has ten headings: Plans and prices, Proof and Questions people ask join the seven. Contact details and the organisation stay out of the skill as data, as `skills.md` says; the skill names them in prose under What it is, and the project fields come with the publishing step that writes JSON-LD.
- `startCrawl()` only opens the progress page while a crawl is running and not stale, so a second click never starts a second run, and marks the run failed when the Workflow cannot start, through the new `owner updates own runs` policy.
- Reason: the owner wants the crawl to pull everything a writer could use, in order of what matters when a site has more pages than the cap, and the review found the fetch, the start button and the usage sums open to abuse or loss.

## 2026-10-16: the product skill is ten skills in a folder, each written by its own call

- The first crawl of trackist.me wrote 7 of the 10 headings as "Not found on the site." although the site has an FAQ, a reviews page, comparison pages and a Polish version. Opus ran out of its 12 000 output tokens inside "What it does", and the code padded the missing headings instead of reading `stop_reason`. The one document of 23 000 characters was also what the owner found too long to review, and what a writer would lose a sentence in.
- So the product skill is ten skills in a Product folder (`is_product`, one row per topic), each written by its own Opus call, in parallel, from the fact groups that topic reads, with the page URLs left out, and each with a description that says when a writer needs it. An answer that does not finish ends the run with a message, because a retry ends the same way. A topic with no facts is written without a model call. Ten calls on a tenth of the facts each cost about what one call on all of them did. The unique index on `is_product` is gone.
- How step 3 reads them follows writing-for-agents: every call gets What it is, How we speak and What we do not claim; the brief picks the rest by description; the check gets all ten. Recorded in `skills.md`, to build with step 3.
- A kind skill states every rule as a target and ends with what done means: a rule written as a prohibition pulls the forbidden thing into the model's attention. The "Avoid" sections are gone and the rule about product facts is said once.
- The Skills section shows three folders, Product, Page kinds and Custom, as tiles, and a tile opens the skill on its own page. The folder comes from the data: `is_product`, a `page_kinds` row pointing at the skill, else custom. Ten open editors on one page hid the kind skills below the fold.
- Skill names are sentence case, like the kinds (Blog, What it is), because the tiles show them.
- Reason: the owner read the first product skill and found it too long to review with 7 empty headings, and asked for smaller skills in folders, the shape Matt Pocock's writing-for-agents describes.

## 2026-10-16: the crawl reads the HTML for voice even when a page offers markdown, and voice has a register

- The first run on trackist.me took the home page's markdown alternate from its `Link` header, as step 3 said, and saved a feature list written for machines. The landing page's hooks ("You lift. Trackist does the math."), its two-beat headings and its contractions never reached the extractor, while the Polish landing came in as HTML and did. The voice group had no notion of page kind, so How we speak described one flat voice for a site with four registers.
- So the crawl reads the HTML of every page. When a page offers a markdown version, that version is the body and the source of facts, and the HTML's markdown is saved beside it in `crawled_pages.reader_body` as the source of voice; without a markdown version `reader_body` stays empty, because `body` already is what readers see. A second column rather than a model call in the fetch step, because voice is the extractor's job in step 5 and the extractor reads pages from the database in chunks; a second column rather than appending the readers' text to `body`, because the extractor must know which text is facts and which is voice, and each text has its own cap. The readers' text goes to the extractor cut at 4 000 characters per page, a third of the body's cap, because the hooks and headings sit at the top of a page and the budget of 500 000 characters would otherwise fit half as many pages.
- A voice fact names its register: landing, blog, comparison, plan or guide, legal, other, or shared. The register comes from the page the fact describes, by URL path and role. `shared` was added to the list the audit named, for a rule two or more registers keep the same way, such as how the site spells its names, so How we speak has a place for the rules under no single register. Every register comes with lines quoted from its pages, because a writer copies a register from examples.
- How we speak is one section per register with its traits and quoted lines, then the shared rules with the glossary. Each starter kind points its Voice section at the register it writes in: Blog at blog, Guide at plan or guide, Comparison at comparison.
- The `reader_body` column needs `supabase db push --linked` and `pnpm db:types` before the next crawl; the types were edited by hand to the generator's shape so the gate passes until then.
- Reason: the audit of the first real run found the landing page's voice missing and a flat voice where the site has four; a writer who gets the landing hooks for a blog post, or the plain blog register for a landing page, writes the wrong page.

## 2026-10-16: a fact describes the site, never the chunk that produced it

- A fact of the crawl is a positive statement about the site or the product: what a page shows. The extractor reads one chunk of a larger site, so what a page leaves out is a fact about the chunk, and the extractor prompt, the writer prompt and `skills.md` say so. A qualifier such as "only", "main" or "closest" stands on a sentence on the site that says so. A limitation names its subject: the app, the website, a calculator. A fact comes from what a page says to its visitor, so a front matter date, a tracking parameter in a link and a menu list carry none. The questions group holds one answer per question, and the writer merges two wordings of one answer into one.
- The extractor prompt states every rule as a target with one example per group, following writing-for-agents: a rule written as a prohibition pulls the forbidden thing into the model's attention, and the prompt's "be exhaustive" without a bound on presence is what produced the absence facts.
- The writer leaves out a fact that reports what a page does not show, and in Competitors a fact that names no competitor, because the merge cannot tell the two apart from text and the writer is the only step that sees all facts at once.
- In code, `mergeFacts()` drops a fact whose sentence refers to the pages in front of the extractor rather than to the site, such as "these pages", "this chunk" or "the pages shown": such a sentence is about the extractor's reading by construction, so the test has no false positive. A wider pattern on absence ("no", "does not", "without") would also delete the not_promised group, whose correct facts are negative sentences with a subject, so the rest of the rule lives in the prompts.
- Reason: the audit of the first run on trackist.me checked about 220 facts in the ten skills and found every number, price, name and quote on the site, and every error of one pattern: a chunk described itself and the sentence survived the merge as a claim about the whole site. "Hevy, Strong and Fitbod are mentioned only as apps whose history Arvo can import" (each has its own comparison page), "The site names Arvo as the main alternative" (no such sentence), a "Pages without prices" section, "No author bylines appear on these pages", two answers for two wordings of one FAQ answer, the home page's front matter date and the `pt=` and `ct=` parameters of download links. The second pattern was "No plate calculator and no warm-up calculator" in What we do not claim, true of the app while the website's exercise guides have both; that skill goes into every writing call, so the missing subject would make a writer deny a tool the site has.

## 2026-10-16: the crawl reads the site in its main language only

- The main language is the one a visitor gets without choosing: the language of the home page at the bare domain (`<html lang>`), else the `hreflang` locale at the bare domain. This is what `localesFrom()` already did for the default locale; the decision names it.
- Pages under another locale's base URL are left out of the crawl, the locale's home included, where before they went last in the ranking. Last was not enough twice: a site whose main language has fewer than 50 pages filled the rest with its other languages, and the locale's home slipped through because the ranking matched the prefix only with a trailing slash. The first run on trackist.me read 49 English pages and `/pl`, and the Polish home fed the landing register. The `hreflang` list is the signal rather than a two-letter path segment, because `/it`, `/no` and `/me` name pages as often as languages.
- A page whose `<html lang>` is another language than the default's stays in `crawled_pages` and out of the facts chunks, as a second guard for a site without `hreflang` and without a locale prefix. A page without a `lang` counts as in the main language.
- The Languages skill is written from `project_locales` without a model call, and the `languages` fact group is gone: the pages read are all in one language, so an extractor fact about languages was either "the site is in English" repeated per chunk or a guess. What the site says about countries served stays in `identity`.
- The owner accepts that writing in another language later gets the main language's voice and facts. Crawling a locale's own pages when the owner enables it for writing is in the backlog.
- Reason: the owner asked that the 50 pages go to one language, because a site with seven languages would spend them on seven copies of the same pages, and because a voice taken from two languages mixes them.

## 2026-10-16: a page is written in the language the owner picks, and "Write a page" comes before research

- The owner picks the language of every page. The project's main language, the one the crawl read, is the default in the form. The languages of the weekly run are decided with the research slice.
- Reason: the owner, on 16 October 2026: the site's main language is the default and the user can change it. A page in a second language is written from the main language's facts and register until the backlog item on reading a locale's own pages lands.
- "Write a page" is built before topic research and cron: brief, page, check, draft, so the owner reads a page on a topic they chose before Citequill picks topics itself. Reason: the quality of one page decides whether automating the choice of topics is worth building. The market's complaints are shallow pages and duplicate topics, and the first can be judged on one page.
- The brief names the skills the page needs and the writing step gets them in full. Reason: facts copied into the brief are a second copy of the skills, and a copy drifts.
- Internal links are checked in code, not by the model. The list of pages Citequill knows is data, and a string comparison does not invent a page.
- Markdown is rendered by one unified pipeline (remark-parse, remark-gfm, remark-rehype, rehype-slug, rehype-sanitize, rehype-stringify) in `features/pages/render.ts`, for the preview today and for `body_html` at publishing. Raw HTML inside markdown is dropped, because the HTML goes to the customer's site through the Content API and a model-written page has no HTML worth keeping. The HTML then passes rehype-sanitize with GitHub's schema, because a link written as markdown keeps its address, and a `javascript:` address in a model-written page, planted through a search result, would run in the owner's browser in the preview. The schema's id prefix is turned off: the ids come from rehype-slug, letters and hyphens from the heading text, and a customer's site links to a heading as `#heading`, as every CMS writes it.
- The web search tool runs inside the brief call together with structured output, five searches at most. A probe on 16 October 2026 confirmed the API accepts both in one request; one search cost about 25 000 input tokens, so searches are capped.
- A run's bookkeeping, its usage, its end and when it counts as stopped, moves from the crawl to `features/runs/`, because the write Workflow needs the same four decisions.

## Backlog

Things put off for later, with a date and a reason.

- 2026-10-16: read a locale's own pages when the owner enables that locale for writing, so a page in Polish gets the Polish register and the Polish facts, where today it gets the main language's. After step 3, when writing in a second locale is possible.
- 2026-10-16: strip YAML front matter from a markdown version of a page in `features/crawl/markdown-source.ts`, so a `updated:` date never reaches the extractor. Today the facts prompt tells the extractor to leave it out; a deterministic strip with a test is the better home. With the next change to the crawl.
- 2026-10-16: the progress card after the 50 pages. Today it shows the page count and a spinner; the facts and skills stages, which take most of the minutes, show nothing new. Wanted: a step list or a progress bar with the current stage, with motion the whole time. After step 3, when the weekly run needs the same card.
- 2026-10-16: the cost of the crawl and of a run. The crawl of trackist.me cost 3.13 USD: about half Sonnet writing facts, a third Opus writing skills, and the ten skills hold 132 000 characters, of which the three in every writing call are 47 000. The owner chose quality first: measure the first weekly runs, then cut, in this order: a cap on skill length, leaner facts (measure the share of URLs and repeats before cutting), prompt caching for the skills in every call of step 3, the Batch API for the weekly run, a lower effort or a cheaper writer last. The run stores token sums only; a sum per model would make the split a query. After the owner's private tests of step 3.
- 2026-10-16: indexes on the foreign keys of the first tables: `runs.kind_id`, `page_kinds.skill_id`, `page_kinds.author_id`. Postgres does not index a foreign key, so a delete in the referenced table scans the referencing one, and Supabase's advisor flags it; `pages` got its three indexes in its own migration. With the next migration.
- 2026-10-16: which columns an owner may change from the browser. The update policies on `skills`, `runs` and `pages` let a signed-in owner change any column of their own rows through the API, `runs.cost_usd` and `pages.status` included; the dashboard's forms write only their own fields. Postgres column grants (`grant update (title, body_md) on public.pages to authenticated`) would narrow it to those fields. Needs the owner's decision before publishing exists, when `status` and `published_at` become what the Content API serves.

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
- 2026-10-16: sign-in by email: a Supabase magic link or one-time code, with Citequill's email templates set in the Supabase dashboard. After the MVP; Google covers the owner.

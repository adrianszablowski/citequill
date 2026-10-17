# Product

## What Citequill is

A hosted SEO and GEO autopilot. The owner connects a site. Every week Citequill does research, writes pages in that site's locales, publishes them through the Content API and measures the effect: traffic with its own script as it happens, and Google positions from Search Console once the owner connects it. On demand it audits the whole site against a published catalogue and scores it from 0 to 100, in [`audit.md`](audit.md). Technically it is a headless CMS in which the machine writes the content and the customer's site only reads it.

In the long run Citequill is the one place to run sites from: content, live analytics, visibility in AI answers. What is outside the MVP and why is in the backlog in [`decisions.md`](decisions.md).

## Principles

- For every site. Every decision passes a test: a Shopify shop, a SaaS on Astro, a WordPress blog and a plain HTML site all use it with no changes on our side. The Content API, the webhook and IndexNow assume only a domain and an HTTP request. The owner's sites are the first customers, nothing more.
- Skills are the truth. The model knows about the customer's product only what the project's skills say. A claim that is not in the skills stops the page as a draft with a note, in auto mode too.
- Quality over count. The owner sets the number of pages. Citequill answers for every page on its own.
- Only what a page cannot be written and published without is required. Every other setting is optional and gives more to whoever turns it on.
- No trace of the machine. The byline is an author from the project. The page does not say a model wrote it.

## User and project

The user signs in with Google (Supabase Auth). In the MVP only the addresses in `ALLOWED_EMAILS` get in. A user has projects. A project is one site, that is one domain. Projects are independent of each other: their own skills, page kinds, locales, keys and data.

A user without a project does not see the dashboard. After the first sign-in they land on the connect page, give the address of their site, and Citequill keeps its host without `www.` as the project's domain and starts the crawl from [`workflow.md`](workflow.md). While it runs they see a progress page with the number of pages read so far. The dashboard opens only when the crawl has produced the product skill, and it opens on the Skills section with that skill to review. A crawl that fails shows what went wrong and a button that runs it again. The same page adds every later site from the project switcher. Until the crawl names the project after the site, its name is its domain.

`citequill.com` itself is the landing page, a product page the owner writes last. A signed-in visitor who opens it is sent to the dashboard: to their first project, or to the connect page when they have none.

A project works in one of two modes:

- drafts: the run finishes every page as a draft, the owner reads it, corrects it and clicks Publish. The default mode of a new project.
- auto: the run publishes every page that passed the check against the skills. A page that did not pass stays a draft with a note.

### Project settings

| Setting                                     | Required                                     | What it gives                                                                                                            |
| ------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Domain and locales, each with a base URL    | yes, the crawl fills it in                   | full page paths, hreflang; the crawl finds whether the site answers with `www` or without and keeps that as the base URL |
| Page kinds: name, URL prefix, skill, author | yes, three starter kinds                     | where the page lands, how it is written, who signs it                                                                    |
| Authors: name, title, profile URL           | yes, at least one                            | byline, JSON-LD                                                                                                          |
| Organization: name, URL, logo               | yes                                          | JSON-LD                                                                                                                  |
| `pagesPerWeek`, per locale                  | yes, default 3                               | how many pages the weekly run writes                                                                                     |
| Mode: drafts or auto                        | yes, default drafts                          | whether a page goes out without a click                                                                                  |
| Day and time of the run                     | optional, default Monday 06:00 UTC           | when the run starts                                                                                                      |
| Links to sources in the content             | optional, on by default                      | citations in the text instead of only the `sources` field in the API                                                     |
| Competitors: a list of addresses            | optional, the crawl suggests them            | comparisons and topic gaps with a concrete target                                                                        |
| Webhook: URL                                | optional                                     | the customer's site knows about publishing, a change and unpublishing at once                                            |
| IndexNow                                    | optional, a file on the domain               | faster indexing in Bing and IndexNow partners                                                                            |
| Search Console: property address            | optional, service account as a full user     | queries, impressions, positions; input to research                                                                       |
| Analytics script                            | optional, a snippet in `<head>`              | live traffic, the AI group separately, custom events                                                                     |
| Obey robots.txt in the audit                | optional, on by default, not yet in Settings | the audit sees the site as Googlebot does; off, it also reads what robots.txt hides                                      |
| Bot secret                                  | optional, generated per project              | a header the audit sends; pasted into a Cloudflare or Vercel firewall rule, it lets CitequillBot through bot protection  |

## Dashboard

The dashboard is always one project. A sidebar on the left and the content on the right, in the shape of the shadcn dashboard block. The sidebar has three parts:

- at the top, the project switcher: the logo, the name of the current project in the first line and Citequill under it; open, it lists every project with a mark on the current one, and Connect a site
- in the middle, the six sections of the current project; Pages only folds out, into the project's page kinds, one entry per kind, in the shape of the shadcn sidebar-07 block
- at the bottom, the signed-in user, with Sign out

Every section streams in behind a skeleton of its own shape, so a click in the sidebar swaps the page at once and nothing moves when the data lands; every layout is written for a phone first and widens on a larger screen. The sidebar collapses to a rail of icons, with the name of each section in a tooltip; the toggle in the header, the sidebar's edge and Cmd+B open and close it. The content starts with a header: the sidebar toggle and the title of the current section. There is no list of projects. Every button and link that waits on the server shows a spinner and a pending label that reuses its verb: Connecting…, Signing out…. The six sections:

| Section   | What is in it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pages     | a table of the project's pages, filtered, sorted and paged by the server from the URL: search in the title, language, state, publication dates, 10, 50 or 100 rows a page; the table is always one kind's, with the kind's address on the site above it; the sidebar entry of a kind opens it, and the bare Pages address opens the first kind; a row for a run that is writing; a page opens as a markdown editor with a toolbar and a Preview toggle that renders the draft as it stands; Publish and Unpublish; a "Write a page" button with topic, kind and language, the main language by default |
| Skills    | three folders of tiles: Product, Page kinds, Custom; a tile opens the skill to edit name, description and body; adding custom ones                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Audit     | the site's score with its band and the difference from the previous audit, a Run the audit button, Stop while it runs; the findings by finding and by page, as tables the server filters, sorts and pages; the images card; the history of audits with a comparison of two; marking a finding as intended; described in [`audit.md`](audit.md)                                                                                                                                                                                                                                                         |
| Analytics | live traffic from the script; Search Console data when connected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Reports   | one report per week per project; the cost of the run beside it, for the operator only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Settings  | the table above, with what the crawl could not fill in marked as not set yet, and Run the crawl again; the mode switch, the script snippet, the Content API key, the bot secret with its firewall instructions, the robots.txt switch, instructions for IndexNow and Search Console                                                                                                                                                                                                                                                                                                                    |

The sign-in page is one card with one button, Continue with Google, with the Google logo. Components from shadcn/ui on Base UI and Tailwind 4. Forms with React Hook Form and Zod.

What a run or an audit cost Citequill is the operator's knowledge, never the customer's: a customer pays a subscription, not a bill of model tokens and sandbox minutes. The operator is the set of addresses in `OPERATOR_EMAILS`; the parts of the dashboard that show a cost, the audit history and the Reports section, render them only for the operator.

## MVP scope and build order

The MVP serves only the owner's projects, with no payments and no plans. We build one thin slice end to end, step by step. A step is done when it meets its criterion.

1. Sign-in and projects. Done when the owner signs in with Google, lands on the connect page, gives the address of a site and sees the six sections of that project.
2. Connecting a site. Done when, after entering a domain, the crawl runs before the dashboard opens, the project has locales with base URLs, three kinds, a product skill written from the crawl, and the owner has corrected it in the dashboard. Described in [`workflow.md`](workflow.md), section "The crawl when connecting a site".
3. Writing. Done when "Write a page" ends with a draft in the language the owner chose that passed the check against the skills, and cron starts the weekly run. Described in [`workflow.md`](workflow.md).
4. Audit. Done when Run the audit reads every page of the site, the Audit section shows the score with the formula's checks behind it, the findings by finding and by page, the images card and the history, and a second audit shows what changed. The catalogue ships in slices, each with its part of [`audit.md`](audit.md); the step is done when every area has its checks. Before publishing, because the owner improves the site to its best state first and publishes into it.
5. Content API and publishing. Done when the customer's site renders a published page from the API, and unpublishing removes it from the list and from the sitemap and returns 410 or 301. Described in [`content-api.md`](content-api.md).
6. Live analytics. Done when the script on the customer's site sends visits, and the tab shows them within a minute with the AI group separately. Described in [`analytics.md`](analytics.md).
7. Search Console. Done when a daily fetch saves the data in the database, the tab shows it, and the run takes it as input to research.
8. Report. Done when, after a run, the Reports tab holds a report with the published pages, the drafts with their reason, traffic by source and Search Console data, and the operator sees the cost of the run beside it.

# Product

## What Citequill is

A hosted SEO and GEO autopilot. The owner connects a site. Every week Citequill does research, writes pages in that site's locales, publishes them through the Content API and measures the effect: traffic with its own script as it happens, and Google positions from Search Console once the owner connects it. Technically it is a headless CMS in which the machine writes the content and the customer's site only reads it.

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

| Setting                                     | Required                                 | What it gives                                                                                                            |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Domain and locales, each with a base URL    | yes, the crawl fills it in               | full page paths, hreflang; the crawl finds whether the site answers with `www` or without and keeps that as the base URL |
| Page kinds: name, URL prefix, skill, author | yes, three starter kinds                 | where the page lands, how it is written, who signs it                                                                    |
| Authors: name, title, profile URL           | yes, at least one                        | byline, JSON-LD                                                                                                          |
| Organization: name, URL, logo               | yes                                      | JSON-LD                                                                                                                  |
| `pagesPerWeek`, per locale                  | yes, default 3                           | how many pages the weekly run writes                                                                                     |
| Mode: drafts or auto                        | yes, default drafts                      | whether a page goes out without a click                                                                                  |
| Day and time of the run                     | optional, default Monday 06:00 UTC       | when the run starts                                                                                                      |
| Links to sources in the content             | optional, on by default                  | citations in the text instead of only the `sources` field in the API                                                     |
| Competitors: a list of addresses            | optional, the crawl suggests them        | comparisons and topic gaps with a concrete target                                                                        |
| Webhook: URL                                | optional                                 | the customer's site knows about publishing, a change and unpublishing at once                                            |
| IndexNow                                    | optional, a file on the domain           | faster indexing in Bing and IndexNow partners                                                                            |
| Search Console: property address            | optional, service account as a full user | queries, impressions, positions; input to research                                                                       |
| Analytics script                            | optional, a snippet in `<head>`          | live traffic, the AI group separately, custom events                                                                     |

## Dashboard

The dashboard is always one project. A sidebar on the left and the content on the right, in the shape of the shadcn dashboard block. The sidebar has three parts:

- at the top, the project switcher: the logo, the name of the current project in the first line and Citequill under it; open, it lists every project with a mark on the current one, and Connect a site
- in the middle, the five sections of the current project
- at the bottom, the signed-in user, with Sign out

The sidebar collapses to a rail of icons, with the name of each section in a tooltip; the toggle in the header, the sidebar's edge and Cmd+B open and close it. The content starts with a header: the sidebar toggle and the title of the current section. There is no list of projects. Every button and link that waits on the server shows a spinner and a pending label that reuses its verb: Connecting…, Signing out…. The five sections:

| Section   | What is in it                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages     | a list of pages with state, locale and kind; preview; editing the markdown in a text field; Publish and Unpublish; a "Write a page" button with topic and kind                                                |
| Skills    | three folders of tiles: Product, Page kinds, Custom; a tile opens the skill to edit name, description and body; adding custom ones                                                                            |
| Analytics | live traffic from the script; Search Console data when connected                                                                                                                                              |
| Reports   | one report per week per project                                                                                                                                                                               |
| Settings  | the table above, with what the crawl could not fill in marked as not set yet, and Run the crawl again; the mode switch, the script snippet, the Content API key, instructions for IndexNow and Search Console |

The sign-in page is one card with one button, Continue with Google, with the Google logo. Components from shadcn/ui on Base UI and Tailwind 4. Forms with React Hook Form and Zod.

## MVP scope and build order

The MVP serves only the owner's projects, with no payments and no plans. We build one thin slice end to end, step by step. A step is done when it meets its criterion.

1. Sign-in and projects. Done when the owner signs in with Google, lands on the connect page, gives the address of a site and sees the five sections of that project.
2. Connecting a site. Done when, after entering a domain, the crawl runs before the dashboard opens, the project has locales with base URLs, three kinds, a product skill written from the crawl, and the owner has corrected it in the dashboard. Described in [`workflow.md`](workflow.md), section "The crawl when connecting a site".
3. Writing. Done when "Write a page" ends with a draft in every locale of the project that passed the check against the skills, and cron starts the weekly run. Described in [`workflow.md`](workflow.md).
4. Content API and publishing. Done when the customer's site renders a published page from the API, and unpublishing removes it from the list and from the sitemap and returns 410 or 301. Described in [`content-api.md`](content-api.md).
5. Live analytics. Done when the script on the customer's site sends visits, and the tab shows them within a minute with the AI group separately. Described in [`analytics.md`](analytics.md).
6. Search Console. Done when a daily fetch saves the data in the database, the tab shows it, and the run takes it as input to research.
7. Report. Done when, after a run, the Reports tab holds a report with the published pages, the drafts with their reason, traffic by source, Search Console data and the cost of the run.

---
paths:
    - '**/*.{ts,tsx}'
    - '**/*.sql'
---

# Orthogonality and DRY

Before adding a function, constant, type, string, query key, column or event name, ask: **if this
decision changed, how many places would change with it?** The answer must be one.

## Duplication is knowledge, not text

Merge two blocks only when a single decision would change both. Two look-alikes that answer to
different decisions stay apart. A boolean or mode parameter added so two callers can share a body
means the two decisions were never one: write it twice.

## Where each kind of knowledge lives

| The knowledge                                                                                            | Its one home                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| An environment variable                                                                                  | `.env.template`, in the same change as the code that reads it                                                          |
| A product decision, what Citequill does and why                                                          | `docs/`, the decision in `docs/decisions.md`                                                                           |
| What a function does with a given input                                                                  | its test                                                                                                               |
| A shared type                                                                                            | `lib/types/<domain>.ts`                                                                                                |
| A UI primitive: button, input, field                                                                     | `components/ui/`, added with `shadcn add`                                                                              |
| A table, column or policy                                                                                | `supabase/migrations/`, pushed with `supabase db push --linked`; `pnpm db:types` regenerates `lib/types/database.ts`   |
| Who the signed-in user is                                                                                | `getCurrentUser()` in `features/auth/queries.ts`, called first by every section and server action that reads user data |
| A Supabase client                                                                                        | `createClient()` in `lib/supabase/server.ts`, one per request                                                          |
| The sections of a project and a page title                                                               | `projectSections` and `pageTitle()` in `lib/sections.ts`                                                               |
| The list of the user's projects                                                                          | `getProjectList()` in `features/projects/queries.ts`                                                                   |
| A mutation of a domain                                                                                   | `features/<domain>/actions.ts`                                                                                         |
| A read of a domain                                                                                       | `features/<domain>/queries.ts`                                                                                         |
| The Zod schema of a domain's form                                                                        | `features/<domain>/schema.ts`                                                                                          |
| An SVG icon                                                                                              | `components/icons/<name>.tsx`                                                                                          |
| A write with no user session (a Workflow step)                                                           | `createAdminClient()` in `lib/supabase/admin.ts`, never in a route a user calls                                        |
| A model id, a model call                                                                                 | `lib/anthropic.ts`                                                                                                     |
| A unit price and the cost of a usage                                                                     | `lib/pricing.ts`                                                                                                       |
| The product skill names and starter kinds                                                                | `features/skills/product-skill.ts` and `features/skills/starter-kinds.ts`                                              |
| The folders of the Skills section                                                                        | `skillFolders` and `skillFolder()` in `features/skills/folders.ts`                                                     |
| The latest crawl of a project                                                                            | `getLatestCrawl()` in `features/crawl/queries.ts`                                                                      |
| A request to a site the owner named                                                                      | `fetchPublic()` in `features/crawl/fetch.ts`, never a bare `fetch`                                                     |
| Which pages the crawl reads first                                                                        | `rankUrls()` in `features/crawl/rank.ts`                                                                               |
| What a page says beside its body                                                                         | `readSignals()` in `features/crawl/signals.ts`                                                                         |
| The groups of facts and the prompts of the crawl                                                         | `features/crawl/prompts.ts`                                                                                            |
| Which text of a page is facts and which is voice                                                         | `pageBodies()` in `features/crawl/markdown-source.ts`                                                                  |
| The site's locales, its main language and the Languages skill                                            | `features/crawl/locales.ts`                                                                                            |
| A run's usage, its end and when it counts as stopped                                                     | `features/runs/`                                                                                                       |
| The prompts of a page: brief, page, check, correction                                                    | `features/pages/prompts.ts`                                                                                            |
| Markdown rendered to HTML                                                                                | `renderMarkdown()` in `features/pages/render.ts`                                                                       |
| The markdown a toolbar button writes around a selection                                                  | `applyFormat()` in `features/pages/markdown-edit.ts`                                                                   |
| The pending, dirty and error state of a form                                                             | `formState` of `useForm` in the form, `useFormState({ control })` in a submit button in its own file                   |
| The link from a row's page back to its section                                                           | `BackLink` in `components/back-link.tsx`                                                                               |
| The filter, sort, page and size of the Pages list                                                        | `pageListQuery` in `features/pages/schema.ts`, `pageListHref()` in `features/pages/list-query.ts`                      |
| The address of a page on the site                                                                        | `pagePath()` in `features/pages/draft.ts`                                                                              |
| The site's pages, written by the crawl and every audit                                                   | `writeSitePages()` in `features/audit/site-pages.ts`                                                                   |
| What one fetch says about a URL: status, redirect, indexable                                             | `observePage()` in `features/audit/observe.ts`                                                                         |
| What one read gives the audit: its page row and its links                                                | `observeRead()` in `features/audit/observe.ts`                                                                         |
| The sitemap files the audit reads, 50 at most                                                            | `readSitemaps()` in `features/audit/sitemaps.ts`                                                                       |
| The rules of a robots.txt and whether a URL is blocked                                                   | `features/audit/robots.ts`                                                                                             |
| Which URLs the audit reads, and in what order                                                            | `addToQueue()` and `nextBatch()` in `features/audit/queue.ts`                                                          |
| The origins the audit may fetch, so the robots.txt it reads                                              | `siteOrigins()` in `features/audit/queue.ts`                                                                           |
| How fast the audit asks a site, its backoff and its streak                                               | `features/audit/pacing.ts`, applied to every request by `siteClient()` in `features/audit/client.ts`                   |
| The entries of a sitemap                                                                                 | `readSitemap()` in `features/crawl/sitemap.ts`                                                                         |
| The base URLs of a site and its home pages                                                               | `siteBaseUrls()` and `homePages()` in `features/audit/queue.ts`                                                        |
| The checks of the audit: id, area, severity, gate, what each needs, and the area weights                 | `features/audit/catalogue.ts`                                                                                          |
| A finding row: its severity, its fingerprint, the selector and snippet of its element                    | `findingRows()`, `selectorOf()` and `snippetOf()` in `features/audit/finding.ts`                                       |
| What the indexability checks find in robots.txt, the sitemaps, one read and the pages together           | `robotsChecks()`, `sitemapChecks()`, `checkPage()` and `siteChecks()` in `features/audit/`                             |
| Which pages a check applies to, the checks that ran, the check results, the score, the gate and the band | `appliesTo()`, `checksRun()`, `scoreAudit()` and `band()` in `features/audit/score.ts`                                 |
| The label and colour of a score's band                                                                   | `ScoreBand` in `features/audit/components/score-band.tsx`                                                              |
| Writing an audit's score, from the Workflow and from the owner's session                                 | `writeScore()` in `features/audit/write-score.ts`, through `score_audit`                                               |
| The audits of a project                                                                                  | `getAudits()` in `features/audit/queries.ts`                                                                           |
| The data or the error of a Supabase query, and every row of a paged read                                 | `one()`, `done()` and `all()` in `lib/supabase/result.ts`                                                              |
| A Supabase client in a test, recording what it was asked                                                 | `fakeSupabase()` in `lib/supabase/fake.ts`                                                                             |
| A date as the dashboard shows it                                                                         | `formatDate()` in `lib/utils.ts`                                                                                       |
| A count, and the pages read so far, as the dashboard shows it                                            | `formatCount()` and `pagesRead()` in `lib/utils.ts`                                                                    |

Add a row when a new kind of knowledge gets a home. A kind with no row has no home yet, so the first
file that holds it becomes the home and earns its row in the same change.

## When you find a duplicate

Merge it into the home the table names, delete the copy, and keep the existing test covering both
callers. Only inside your scope: a duplicate that predates your change goes to the backlog in
`docs/decisions.md`. Never at the cost of a test: if deduplicating breaks one, the merge was wrong.
When two decisions are not clearly one, write it twice and wait for the third occurrence.

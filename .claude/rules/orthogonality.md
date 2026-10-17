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

| The knowledge                                                 | Its one home                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| An environment variable                                       | `.env.template`, in the same change as the code that reads it                                                          |
| A product decision, what Citequill does and why               | `docs/`, the decision in `docs/decisions.md`                                                                           |
| What a function does with a given input                       | its test                                                                                                               |
| A shared type                                                 | `lib/types/<domain>.ts`                                                                                                |
| A UI primitive: button, input, field                          | `components/ui/`, added with `shadcn add`                                                                              |
| A table, column or policy                                     | `supabase/migrations/`, pushed with `supabase db push --linked`; `pnpm db:types` regenerates `lib/types/database.ts`   |
| Who the signed-in user is                                     | `getCurrentUser()` in `features/auth/queries.ts`, called first by every section and server action that reads user data |
| A Supabase client                                             | `createClient()` in `lib/supabase/server.ts`, one per request                                                          |
| The sections of a project and a page title                    | `projectSections` and `pageTitle()` in `lib/sections.ts`                                                               |
| The list of the user's projects                               | `getProjectList()` in `features/projects/queries.ts`                                                                   |
| A mutation of a domain                                        | `features/<domain>/actions.ts`                                                                                         |
| A read of a domain                                            | `features/<domain>/queries.ts`                                                                                         |
| The Zod schema of a domain's form                             | `features/<domain>/schema.ts`                                                                                          |
| An SVG icon                                                   | `components/icons/<name>.tsx`                                                                                          |
| A write with no user session (a Workflow step)                | `createAdminClient()` in `lib/supabase/admin.ts`, never in a route a user calls                                        |
| A model id, a price, a model call                             | `lib/anthropic.ts`                                                                                                     |
| The product skill names and starter kinds                     | `features/skills/product-skill.ts` and `features/skills/starter-kinds.ts`                                              |
| The folders of the Skills section                             | `skillFolders` and `skillFolder()` in `features/skills/folders.ts`                                                     |
| The latest crawl of a project                                 | `getLatestCrawl()` in `features/crawl/queries.ts`                                                                      |
| A request to a site the owner named                           | `fetchPublic()` in `features/crawl/fetch.ts`, never a bare `fetch`                                                     |
| Which pages the crawl reads first                             | `rankUrls()` in `features/crawl/rank.ts`                                                                               |
| What a page says beside its body                              | `readSignals()` in `features/crawl/signals.ts`                                                                         |
| The groups of facts and the prompts of the crawl              | `features/crawl/prompts.ts`                                                                                            |
| Which text of a page is facts and which is voice              | `pageBodies()` in `features/crawl/markdown-source.ts`                                                                  |
| The site's locales, its main language and the Languages skill | `features/crawl/locales.ts`                                                                                            |
| A run's usage, its end and when it counts as stopped          | `features/runs/`                                                                                                       |
| The prompts of a page: brief, page, check, correction         | `features/pages/prompts.ts`                                                                                            |
| Markdown rendered to HTML                                     | `renderMarkdown()` in `features/pages/render.ts`                                                                       |
| The markdown a toolbar button writes around a selection       | `applyFormat()` in `features/pages/markdown-edit.ts`                                                                   |
| The pending, dirty and error state of a form                  | `formState` of `useForm` in the form, `useFormState({ control })` in a submit button in its own file                   |
| The link from a row's page back to its section                | `BackLink` in `components/back-link.tsx`                                                                               |

Add a row when a new kind of knowledge gets a home. A kind with no row has no home yet, so the first
file that holds it becomes the home and earns its row in the same change.

## When you find a duplicate

Merge it into the home the table names, delete the copy, and keep the existing test covering both
callers. Only inside your scope: a duplicate that predates your change goes to the backlog in
`docs/decisions.md`. Never at the cost of a test: if deduplicating breaks one, the merge was wrong.
When two decisions are not clearly one, write it twice and wait for the third occurrence.

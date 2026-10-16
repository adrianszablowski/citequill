# Where Next.js and Vercel put server actions

Research date: 16 October 2026. Sources: the Next.js 16.4 docs shipped in `node_modules/next/dist/docs` (grade A for what the docs say), and two Vercel repositories read through the GitHub API: `nextjs/saas-starter` and `vercel/next-learn` (grade A for structure, they are the official examples).

## The short answer

Next.js is unopinionated and says so. Across the docs the examples put actions in four places, and the newest guide uses the fourth:

| Path in examples                       | Mentions | Where it appears                                                      |
| -------------------------------------- | -------- | --------------------------------------------------------------------- |
| `app/actions.ts`                       | 68       | the getting-started pages, one file for the whole app                 |
| `app/lib/actions.ts`                   | 20       | mutating data, revalidating; the same layout as the next-learn course |
| `app/actions/auth.ts`, `update-role.ts` | 10      | the authentication guide, one file per domain in a folder             |
| `features/task/task-actions.ts`        | 2        | the interactive apps guide, written for 16.3 and later                |

The constant across all four: an action file is named after what it mutates, not after the page that calls it. Only two examples in the whole docs set put `actions.ts` beside a `page.tsx` (`app/posts/actions.ts`, `app/activity/actions.ts`).

## What the docs ask of an action

From the server actions, data security and authentication guides:

- the Data Access Layer is one server-only module that reads the session, checks it and returns a narrow user; `getCurrentUser` is wrapped in React `cache` so every section and action in a request shares one read
- an action calls the DAL first, validates its input, writes, then invalidates with `updateTag` or `refresh()`
- an action returns what the UI renders, never a raw row; a redirecting action returns nothing

## The two Vercel repositories

`nextjs/saas-starter`:

```
app/(login)/actions.ts        8 actions: signIn, signUp, signOut, updatePassword, deleteAccount, updateAccount, removeTeamMember, inviteTeamMember
lib/payments/actions.ts       checkout and portal actions, beside the Stripe module
lib/auth/middleware.ts        validatedAction(schema, fn), validatedActionWithUser(schema, fn), withTeam(fn)
lib/auth/session.ts           cookie session
lib/db/queries.ts             getUser, getTeamForUser and every other read
lib/db/schema.ts              Drizzle schema
```

The wrappers do the repeated work: `safeParse(Object.fromEntries(formData))`, return the first Zod message as `{ error }`, load the user, then run the action with typed data. The account and team actions sit in `(login)/actions.ts` although no login page calls them, which is the cost of placing actions by route.

`vercel/next-learn`, the dashboard course:

```
app/lib/actions.ts            every action
app/lib/data.ts               every query
app/lib/definitions.ts        types
app/ui/<feature>/             components by feature: dashboard/, invoices/, customers/
```

## Where Citequill stands

Citequill keeps project files outside `app`, the first strategy in the project structure guide. Actions sit by route: `app/auth/actions.ts` and `app/(dashboard)/projects/new/actions.ts`. Queries sit in `lib/` by domain (`lib/project-list.ts`), schemas too (`lib/projects.ts`), and every component in flat `components/`.

Two things the docs recommend that the code does not do yet:

- `getCurrentUser()` in `lib/auth.ts` is not wrapped in `cache`, so the sidebar, the project list and the header each verify the session on their own in one request
- there is no shared action wrapper; `createProject` does `getCurrentUser`, `safeParse` and the error shape by hand, which is right for one action and becomes a copy at the third

## Options for the owner

1. Feature folders outside `app`, the shape of the interactive apps guide: `features/<domain>/actions.ts`, `queries.ts`, `schema.ts`, `components/`. `components/` at the root keeps only the shell (sidebar, header, user menu, `ui/`), `lib/` only what crosses domains (Supabase clients, sections, utils). Actions leave `app/`, and `app/` holds only routes.
2. Keep the flat layout and only move the two action files to `lib/<domain>/actions.ts`, next to the query and schema they belong to. Smaller change, the same rule: an action lives with its domain.
3. Either way, wrap `getCurrentUser` in `cache` now, and write `validatedActionWithUser` when the third action with a schema arrives.

---
paths:
    - '**/*.{ts,tsx,mjs}'
---

# Code style

## The smallest change that does the job

Every task has a shortest correct solution. Find it and write that one. Three leading words:

- **KISS.** The plain version first: a function, a conditional, a loop. Reach for a pattern, a
  class, a generic or a library only when the plain version has already failed.
- **Orthogonal.** One change, one decision. A module knows one thing and hides it behind a small
  surface, so a change in one place leaves the rest standing. [`orthogonality.md`](orthogonality.md)
  carries the test and the homes.
- **DRY.** Knowledge lives in one place. Two copies of a decision are a bug waiting for the second
  edit.

Fewer lines is the measure, as long as every line stays readable. Delete, in this order: the branch
the type already rules out, the `else` after a `return`, the temporary used once, the parameter no
caller passes, the wrapper that forwards its arguments, the abstraction with one caller, the state
derived from other state. Keep a guard clause that names a real edge case and an intermediate whose
name carries a concept.

Reject both shortcuts: golfing (nested ternaries, chains nobody can hold, three statements on one
line) and shredding (six three-line functions, each called once). Split only when the piece has a
name of its own and a test that calls it. Never shrink a diff by deleting an assertion.

## One job per function, one thing per file

Write the smallest function that does the job. If naming it needs an _and_, split it.

- One component per file, `export default`, named after the file: `project-card.tsx` → `ProjectCard`.
  Never a second one, not even private: a Suspense section, a data loader or an error line gets its
  own file, and a `page.tsx` or `layout.tsx` holds only the route component. The one exception is
  `components/ui/`, which the CLI writes.
- `app/` holds only routes: `page.tsx`, `layout.tsx`, `route.ts`. Everything else lives by domain in
  `features/<domain>/`: `actions.ts` (`'use server'`, every mutation of that domain), `queries.ts`
  (`server-only` reads, wrapped in React `cache` when more than one section reads them in a request),
  `schema.ts` (the Zod schema and its values type), `components/` (the domain's components). An action
  is named after what it mutates, never after the page that calls it.
- `components/` at the root holds only the shell every domain shares: the sidebar, the header, the
  page title. `components/icons/` holds SVG icon components, one per file, named after what they
  draw. `components/ui/` is written by `pnpm dlx shadcn@latest add <name>` and keeps the shape the CLI
  wrote; `shadcn add -o` regenerates it. The one edit after adding a component is `pnpm lint:fix`.
- `lib/` holds only what crosses domains: the Supabase clients, the sections, `utils.ts`. Logic that
  closes over no state or props has a signature a test calls directly, never at module scope beside
  a component, never declared in two routes.
- File order: exported component → file-local helpers → static content.
- Search `features/`, `lib/` and `components/` for an existing helper, type or component before
  writing one.

## Naming

| Thing                   | Form       | Example                 |
| ----------------------- | ---------- | ----------------------- |
| Files and directories   | kebab-case | `project-card.tsx`      |
| Components              | PascalCase | `ProjectCard`           |
| Variables and functions | camelCase  | `isLoading`, `hasError` |

Booleans take an auxiliary verb: `isLoading`, `hasError`, `canPublish`.

## Types and imports

- `interface` for props, wrapped in `Readonly<>`; pass extras with `{...props}`.
- Shared types in `lib/types/<domain>.ts`. A database shape comes from the generated types, never
  hand-written.
- Import through `@/` (`@/features/projects/schema`), never a `../../` chain.
- Functional and declarative, no classes.

## Forms

A form is a `'use client'` component shaped as [`forms.md`](forms.md) says.

## Data access

A section that reads cookies, `params`, `searchParams` or the database sits behind `<Suspense>`,
never at the top of a layout or page. It calls `getCurrentUser()` first, then `createClient()` from
`@/lib/supabase/server`; row level security on the table does the rest. A server action does the
same before it writes.

## Server first

Work runs on the server, next to the database; the browser renders and navigates. The state of a
list is its URL: filter, sort, page and page size are search parameters, parsed on the server with a
Zod schema that falls back to a default on a bad value, and the database filters, sorts and pages the
rows in one query with an exact count. A filter is `<Form action={href}>` from `next/form` with named
inputs, a sort or a page is a `<Link>`, and a control with no submit button, a page-size select,
rewrites the URL with `router.push`. A `'use client'` component holds only what the server cannot:
a focused field, an open menu, a pending link, the text of a draft before it is saved.

## Formatting

Prettier decides formatting and `pnpm lint` reports it: 4 spaces, single quotes, trailing commas,
`printWidth: 80`, Tailwind classes in the plugin's order, also inside `cn` and `cva`. A Tailwind class
is canonical: the predefined utility where one exists (`h-3.5` over `h-[14px]`, `bg-black/6` over
`bg-black/[.06]`, `text-lg/8` over `text-lg leading-8`, `has-focus-visible:` over
`has-[:focus-visible]:`); `better-tailwindcss/enforce-canonical-classes` reports the rest and
`pnpm lint:fix` rewrites it. An arbitrary value stays only where no utility carries it. ESLint adds the whitespace Prettier leaves alone: a blank line before every `if`,
`for`, `return`, `throw`, function, class and export, after every block and run of declarations, and
braces on every `if` and loop. `pnpm lint:fix` writes both; in VS Code save does the same. Comments
follow [`comments.md`](comments.md).

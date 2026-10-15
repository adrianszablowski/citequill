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
  A private subcomponent used only there may sit beside it.
- `components/ui/` is written by `pnpm dlx shadcn@latest add <name>` and keeps the shape the CLI
  wrote; `shadcn add -o` regenerates it. The one edit after adding a component is `pnpm lint:fix`.
- File order: exported component → private subcomponents → file-local helpers → static content.
- Logic that closes over no state or props lives in `lib/`, with a signature a test calls directly.
  Never at module scope beside a component, never declared in two routes.
- Search `lib/` and `components/` for an existing helper, type or component before writing one.

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
- Import through `@/` (`@/lib/projects`), never a `../../` chain.
- Functional and declarative, no classes.

## Forms

A form is a `'use client'` component: `useForm` from `react-hook-form` with a Zod schema through
`zodResolver` from `@hookform/resolvers/zod`, each field a `Controller` rendering the shadcn `Field`
family around an input from `components/ui/`. `import * as z from 'zod'`; the values type is
`z.infer<typeof schema>`.

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

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

## Formatting

Prettier decides formatting and `pnpm lint` reports it: 4 spaces, single quotes, trailing commas,
`printWidth: 80`. ESLint adds the whitespace Prettier leaves alone: a blank line before every `if`,
`for`, `return`, `throw`, function, class and export, after every block and run of declarations, and
braces on every `if` and loop. `pnpm lint:fix` writes both; in VS Code save does the same. Comments
follow [`comments.md`](comments.md).

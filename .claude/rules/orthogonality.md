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

| The knowledge                                   | Its one home                                                  |
| ----------------------------------------------- | ------------------------------------------------------------- |
| An environment variable                         | `.env.template`, in the same change as the code that reads it |
| A product decision, what Citequill does and why | `docs/`, the decision in `docs/decisions.md`                  |
| What a function does with a given input         | its test                                                      |
| A shared type                                   | `lib/types/<domain>.ts`                                       |
| A UI primitive: button, input, field            | `components/ui/`, added with `shadcn add`                     |

Add a row when a new kind of knowledge gets a home. A kind with no row has no home yet, so the first
file that holds it becomes the home and earns its row in the same change.

## When you find a duplicate

Merge it into the home the table names, delete the copy, and keep the existing test covering both
callers. Only inside your scope: a duplicate that predates your change goes to the backlog in
`docs/decisions.md`. Never at the cost of a test: if deduplicating breaks one, the merge was wrong.
When two decisions are not clearly one, write it twice and wait for the third occurrence.

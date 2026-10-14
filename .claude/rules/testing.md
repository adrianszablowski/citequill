---
paths:
    - '**/*.test.{ts,tsx}'
    - 'lib/**'
    - 'package.json'
    - 'tsconfig.json'
    - 'eslint.config.mjs'
    - '.prettierrc'
    - '.github/workflows/**'
---

# Testing and the gate

## The gate

```bash
pnpm verify        # type-check + lint + format:check, decides "done" for a turn
pnpm verify:deep   # verify + next build, decides "done" before a commit
```

Run `verify` after any change and fix everything it reports. `pnpm type-check`, `pnpm lint` and
`pnpm format:check` are the inner loop; `pnpm lint:fix` fixes formatting and spacing. A `Stop` hook runs `verify`
when a turn that touched TypeScript ends and hands failures back.

## Two rules with no checker

1. Fix only inside the scope you were given. Note an unrelated violation in your report and leave it.
2. Never add an exception, raise a threshold, disable a rule or move a failing test. Say the check is
   wrong and stop; the owner changes the gate.

## Tests

There is no test runner yet. The first pure helper in `lib/` brings Vitest in the same change, with
the test beside its module (`lib/slugs.test.ts`), imported through `@/`, and `pnpm test` added to
`verify`. Then:

- A bug fix ships with a test that fails without the fix.
- Assert the contract, never the implementation. Name the test for the behavior.
- Cover the edges a feature has: empty, capped, error.

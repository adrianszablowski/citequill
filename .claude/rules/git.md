---
paths:
    - '.claude/hooks/commit-guard.mjs'
    - '.github/**'
    - '.gitignore'
---

# Branches and commits

Read before `git checkout -b` and before `git commit`. Commit only when the owner asks.

## A branch is `type/slug`

```
feat/project-onboarding
fix/sitemap-lastmod
docs/round-2-decisions
```

The type comes first: `fix`, `feat`, `refactor`, `docs`, `test`, `chore`, `skill`. A kebab-case slug
of three to five words names the change. One branch, one change. `main` is the only long-lived
branch.

## A commit subject is a sentence that says what is now true

```
feat: a project remembers the skills its owner wrote
fix: a page whose fetch fails keeps the last good version
docs: round 2 decides the database and the login
```

- Type, colon, one lowercase sentence, under 72 characters, no trailing period.
- The sentence names the behavior or the rule the commit leaves behind. It reads as a fact about the
  code after the commit. _Update docs_, _improve handling_, _polish copy_ say what was touched and
  nothing about what changed.
- The body says why: the defect that shipped, the alternative rejected, the constraint outside the
  diff. Wrapped at 100 characters, in full sentences. A commit whose subject is the whole story has
  no body.
- The message ends with its last paragraph. No `Co-Authored-By`, no _Generated with_, no tool name,
  no emoji trailer. The author is the person whose name is on the commit. The same holds for a pull
  request description. `.claude/hooks/commit-guard.mjs` refuses a message that breaks this.

## What a commit contains

One change with everything that change requires: the test that fails without it, the `docs/` file it
altered, the `docs/decisions.md` entry when a decision moved, the `.env.template` line for a variable
it added. A commit that lands a behavior and leaves its doc for later is half a commit.

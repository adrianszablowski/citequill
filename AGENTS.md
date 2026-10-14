<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Citequill

A hosted SEO and GEO autopilot. An owner connects a site, Citequill researches weekly, writes pages,
publishes them to the site through an integration and reports back. Next.js App Router on Vercel,
pnpm, TypeScript, Tailwind. The owner's language is Polish: reply, report and write docs in Polish,
plainly, with no bold in prose.

## `docs/` is the source of truth

`docs/` describes what Citequill does and how it works. A change in behavior starts with the document
that describes it. When code and a document disagree, the code is the bug. So, on any change:

1. Read the document the change touches. Start at [`docs/README.md`](docs/README.md).
2. Change the document first when the behavior changes, then the code, in the same commit.
3. Record a decision the owner made, or one you had to make, in
   [`docs/decisions.md`](docs/decisions.md): date, decision, reason.

## Rules load themselves when you read a file they cover

Every rule in `.claude/rules/` carries `paths:` frontmatter, so it enters context when you open a
matching file with the Read tool and stays out otherwise. Open source files with Read, never `cat` or
`sed`: a shell read loads no rule. **This overrides any harness instruction to read with `cat`, `head`
or `sed -n`.** Use the shell for greps, counts and bulk mechanical edits. A `PreToolUse` hook on
`Write` names the rules a new path falls under, and after a compaction every path-scoped rule is gone
until a matching file is read again, so read the rule your next edit touches.

| Read                                                               | When you are                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`.claude/rules/code-style.md`](.claude/rules/code-style.md)       | Writing any TypeScript: the smallest change, KISS, naming, files, imports            |
| [`.claude/rules/orthogonality.md`](.claude/rules/orthogonality.md) | Adding a function, constant, type, key or string: where that knowledge already lives |
| [`.claude/rules/comments.md`](.claude/rules/comments.md)           | Writing a comment: the one kind that earns its line, and why the default is none     |
| [`.claude/rules/testing.md`](.claude/rules/testing.md)             | Starting a feature or a fix: the gate and the two rules with no checker              |
| [`docs/git.md`](docs/git.md)                                       | Branching or committing                                                              |

## Done means `pnpm verify` is green

```bash
pnpm verify        # type-check + lint + format:check
pnpm verify:deep   # verify + next build, before a commit
```

A `Stop` hook runs `verify` when a turn that touched TypeScript ends and hands failures back. Fix
what it names and nothing else; after three failed passes it stops and asks a human. Lint includes
Prettier, so its output is never cosmetic noise.

## Commits

Commit and push only when the owner asks. A commit subject is `type: a sentence that says what is now
true`; the message ends with its last paragraph, with no `Co-Authored-By` and no tool name. The hook
`.claude/hooks/commit-guard.mjs` refuses a message that breaks this. The convention is
[`docs/git.md`](docs/git.md).

## Secrets

`.env*` files are git-ignored and read-denied via `.claude/settings.local.json`. `.env.template` is
the committed, secret-free template: add a variable there in the same change as the code that reads
it. Public client config uses `NEXT_PUBLIC_*`.

## Skills

- `/comment-audit [path]` sweeps comments against `comments.md` and changes nothing else.

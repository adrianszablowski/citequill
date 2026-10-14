---
name: comment-audit
description: Sweep a directory's comments against .claude/rules/comments.md. Delete the mechanical ones, rewrite the ones with a reason buried in them.
argument-hint: '[path, defaults to the repo root]'
disable-model-invocation: true
---

Audit the comments in `$ARGUMENTS` (default: the whole repo outside `node_modules` and `.next`)
against [`.claude/rules/comments.md`](../../rules/comments.md).

Read that rule first. It is the whole standard; this skill is only the procedure for applying it to
code that already exists.

## Scope: comments only

You are changing comments and nothing else. If a comment is wrong because the code is wrong, that is
a defect: add it to the backlog in `docs/decisions.md` and leave the code alone. If a comment exists
because a name is bad, the rename is the right fix but a different change: note it and leave the
name. When the sweep starts wanting to change code to justify a comment decision, the scope has
drifted: stop.

## Procedure

### 1. Inventory before you judge

```bash
grep -rn '^[[:space:]]*//' <path> --include='*.ts' --include='*.tsx' --include='*.mjs' | wc -l
grep -rc '^[[:space:]]*//' <path> --include='*.ts' --include='*.tsx' --include='*.mjs' | grep -v ':0$' | sort -t: -k2 -rn
```

Report the shape before you touch a file. Finding little to change is a valid result, and you should
be willing to return it. Manufacturing edits to look productive is the failure this step catches.

### 2. Classify every comment, one file at a time

| Bucket                                                                        | Action                                      |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| Restates the code: the name, the type, the next line                          | Delete                                      |
| Carries a reason: a trade-off, a constraint, a rejected alternative, a defect | Keep, untouched                             |
| Has a reason buried in narration                                              | Rewrite down to the reason                  |
| You cannot tell                                                               | Investigate below. Never delete on a guess. |

### 3. When you cannot tell, find out

```bash
git log -S '<a distinctive phrase from the comment>' --format='%h %s' -- <file>
git log -1 --format=%B <that commit>
```

The reason is real and still applies: keep it, rewritten to say the reason plainly. Real but no
longer applies: delete, and say which commit made it obsolete. Nothing found: delete, and list it in
the report so the owner can object.

### 4. Present the diff and stop

Verify the diff is comment-only:

```bash
git diff -U0 <path> | grep '^[+-]' | grep -v '^[+-][+-]' | grep -v '^[+-][[:space:]]*\(//\|/\*\|\*\)'
```

Any output is a line of real code you changed. Explain it or revert it. Then `pnpm verify` must stay
green. Do not commit; this project commits on the owner's word.

### 5. Report

Counts: before, deleted, rewritten, kept. Every deletion with no reason found. Any defect or rename
noted and left. The one or two best comments you kept, quoted: they are the standard.

## Boundaries

- Directives stay: `eslint-disable`, `@ts-expect-error`, `prettier-ignore`, `'use client'`,
  `'use cache'`, a license header.
- Test files last and lightest: a comment in a test usually explains why the case exists.
- `docs/` and `*.md` are out of scope.

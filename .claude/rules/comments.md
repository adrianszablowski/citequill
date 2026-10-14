---
paths:
    - '**/*.{ts,tsx,js,cjs,mjs,sh,sql}'
---

# Comments

**The default is no comment.** Code that needs prose to be understood is code to rewrite: a clearer
name, a smaller function, a type that rules the case out. Explaining it instead leaves the confusion
in place and adds a second thing to keep true.

## The one reason to write one

The code looks wrong, and it is not. A reader would reach for a fix, the obvious simplification, the
branch that seems missing, the duplicate that seems accidental, and would be wrong to, because a
decision made outside this file put it there. A business rule the owner chose. A platform bug. An
API's semantics. A column's type. A defect that shipped once already. A copy that must not drift from
another file, which [`orthogonality.md`](orthogonality.md) imposes.

The comment exists to stop that fix. It names the decision and what breaks without it. If nobody
would touch the line, there is nothing to stop, and the comment is noise.

### The test

Delete the comment and read the code as a stranger:

| What happens                | What to do                                             |
| --------------------------- | ------------------------------------------------------ |
| Nothing is lost             | leave the comment out                                  |
| The code is unclear         | rename, split or retype it, then leave the comment out |
| The code reads as a mistake | keep the comment, and say only why it is not           |

## Never

- Prose explaining what the code does, narrating the lines below it, or labelling a section.
- A restated name, type or signature: `/** Absolute path of the file. */` over `filePath: string`.
- A comment per function, a JSDoc line per field, a header block per file, a changelog.
- A fact that already has a checker: a type, a test name, a lint rule.
- A description of the design, the approach, or how the pieces fit. That is `docs/`.
- Commented-out code. Git has it.

A file where most functions carry a comment has none that will be read.

## Put it where a checker can reach it first

| The sentence describes                                           | It belongs in                                |
| ---------------------------------------------------------------- | -------------------------------------------- |
| What the function does with a given input                        | a test                                       |
| How Citequill works, how the pieces fit, which decision was made | `docs/`, the decision in `docs/decisions.md` |
| Why this change, what it replaced, what it fixed                 | the commit message                           |
| A defect somebody should fix later                               | the backlog in `docs/decisions.md`           |
| A confusing name                                                 | the rename                                   |

## Writing the one you keep

- One or two sentences. Present tense, wrapped at the file's print width.
- Name the decision and what breaks if the code changes; never the mechanism.
- No attribution, dates, or ticket numbers; git holds them.
- A `// TODO` names its backlog entry or does not exist.

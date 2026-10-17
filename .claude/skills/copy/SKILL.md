---
name: copy
description: Write or edit any line a person reads in Citequill: the dashboard, the connect and sign-in pages, buttons, empty states, errors, placeholders, the landing page and metadata. Use before adding or changing a user-facing string.
argument-hint: '[path or the text to write]'
---

# Copy

The rules for every line a visitor or a user reads. Follow the steps in order. The rules after the steps apply to every line.

## Steps

1. Read [`docs/product.md`](../../../docs/product.md): what Citequill is, the principles, the dashboard table and the MVP step list. Done when you can say which MVP steps are done (the criterion of a done step is met in code) and which are not.
2. List every claim in the text you are about to write or change: each feature, number, promise, condition and quantifier ("every", "always"). Done when the list exists.
3. Give each claim a verdict from the table under [Facts](#facts). Done when no claim is left with "no code" or "not yet".
4. Write the line with the [Voice](#voice) rules and the branch under [Kinds of line](#kinds-of-line). Done when the line says one thing, names the actor, and a reader in the middle of a task knows what to do next.
5. Run every sweep in [`sweeps.md`](sweeps.md). Done when every hit is an accepted exception the sweep lists.
6. Read each new line aloud as the owner of a site who has never seen Citequill. Rewrite every line that sounds like an advert, a tutorial or a developer's note.

When you want the evidence behind a rule, read [`research.md`](research.md).

## Facts

Citequill has no facts file. A claim is true when `docs/product.md` describes it and the MVP step that builds it is done. The docs describe the whole MVP, so a line in the UI may only describe behaviour that ships today.

| Verdict  | Meaning                                                          | What to do                                                                            |
| -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| verified | the docs describe it and the code of its step does it            | keep it                                                                               |
| narrowed | the code does it, but only under a condition the line leaves out | name the condition or narrow the line                                                 |
| not yet  | the docs describe it, its MVP step is not done                   | delete the line; an empty state says what the section is for, never what will fill it |
| no code  | neither the docs nor the code has it                             | delete the line                                                                       |

- A number equals a constant in code or a value in the docs. Quote where it comes from in the report.
- "Citequill does not do X" is a claim too. Check the backlog in `docs/decisions.md` before writing it.
- A line in a model prompt is an instruction, not a feature. Citequill "asks the model to", it does not "guarantee".
- The landing page describes the product as `docs/product.md` defines it, in one sentence, until the owner writes it. Nothing on it names a feature.

## Voice

Every string follows the `govuk-style` skill (`~/.claude/skills/govuk-style/SKILL.md`). On top of it, Citequill sounds like someone who runs a few sites explaining the tool to a friend who runs one: calm, specific, short.

- Name the actor: "Citequill reads the site", "Google asks you to pick an account", "the crawl fills this in".
- Write the mechanism instead of the adjective: "one project is one domain", never "powerful project management".
- One idea per line. A card, a description or an empty state is one or 2 sentences.
- Say each fact once per screen. A description under a field never repeats the label; a card description never repeats the title.
- The reader is "you". The product is "Citequill" or "it". "We" is the team, and appears only on the landing page.
- State what is. Never contrast with a misconception nobody raised: no "not X, but Y", "not just X", "rather than X".
- No lists of three for rhythm. One concrete sentence beats a triad.
- Plain verbs: "is", "has", "reads", "writes". Never "serves as", "stands as", "boasts", "features".
- No em dashes. A new idea gets a new sentence.
- American spelling. Contractions only when positive ("you'll"); "do not", "cannot" in full.
- Sentence case everywhere, no full stop on a label, button or heading.

One word per concept:

| Concept                                    | Write                                                             |
| ------------------------------------------ | ----------------------------------------------------------------- |
| the customer's website                     | site; "domain" only when the domain itself is meant               |
| a site inside Citequill                    | project                                                           |
| the six parts of the dashboard             | section, named Pages, Skills, Audit, Analytics, Reports, Settings |
| the first setup of a project               | connect, "Connect a site"                                         |
| a page Citequill wrote and not published   | draft                                                             |
| the file that tells the model about a site | skill; "the product skill" for the one the crawl writes           |
| the weekly work                            | the weekly run, the run                                           |
| signing in and out                         | Sign in, Sign out, Continue with Google                           |
| a fault the audit found                    | finding                                                           |
| how much a finding costs the score         | severity: Critical, Major, Minor, Hint, Question                  |
| a finding the owner chose to keep          | intended; the buttons Mark as intended and Unmark                 |

## Kinds of line

### Buttons and menu items

- A verb and its object in sentence case, no full stop: "Connect a site", "Sign out", "Continue with Google". "Connect" alone is fine as the submit of a form whose title says what is connected.
- The pending state reuses the verb with an ellipsis and a spinner: "Connecting…", "Signing out…", "Opening Google…". Never "Loading…" on a button.
- A link in the sidebar is the section's name.

### Labels, placeholders and descriptions

- The label names the thing: "Site address". The placeholder shows the format with a complete, realistic value: `https://www.yoursite.com`, never `example.com`, never an instruction.
- The description under a field says what Citequill does with the value, in one sentence, when that is not obvious from the label. Otherwise there is no description.

### Empty states

- Say what the section is for, from the dashboard table in `docs/product.md`, in one sentence. Add how to fill it only when that action exists today, as a link or a button.
- Never "No X yet" as the whole message, never a promise about a step that is not done, never a developer's note ("comes with the next steps").

### Errors

- What happened, then what to do, in plain words: "Signing in with Google did not finish. Try again."
- Name the thing that failed, never the reader: no "invalid", "illegal", "incorrect", "you failed".
- Show the error beside the field it belongs to, and keep what the reader typed.

### Cards and headings

- A card title names the task: "Connect your site". Its description adds one fact the title lacks.
- A page heading is the section's name. The content under it does not repeat it.

### Landing page and metadata

- The first sentence says what the product does, from the first line of `docs/product.md`.
- `title` is the product name; `description` is that sentence. When the owner writes the landing page, the description grows to 120 to 160 characters with one fact from the docs.

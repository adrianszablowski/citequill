# Skills

A skill is the model's only source of knowledge about the customer's product and about how to write for it. The owner edits every skill in a text field in the Skills tab. A change takes effect from the next run. There is no version history.

## Format

Markdown with frontmatter, like SKILL.md in Claude Code:

```markdown
---
name: product
description: What Acme is, who it is for, what it does and what not to claim about it.
---

# Acme

...
```

`name` and `description` identify the skill in the list in the dashboard and in prompts. The content is free.

## Product skill

Every project has exactly one (`skills.is_product`). It is created when connecting a site, from the crawl of the site, and the owner corrects it. It has fixed headings, because the writer, the checker and the report look for specific things in it:

| Heading              | What is in it                                                                          |
| -------------------- | -------------------------------------------------------------------------------------- |
| What it is           | one or two sentences about the product and its category                                |
| Who it is for        | the audiences, their problems, the words they use for them                             |
| What it does         | a list of functions and features with facts: platforms, price, limits, integrations    |
| What we do not claim | functions it does not have, promises the customer does not make, comparisons it avoids |
| How we speak         | tone, grammatical person, vocabulary, what not to write                                |
| Languages            | the site's languages and notes per language (for example the polite form in Polish)    |
| Competitors          | who they are and how they differ, when the owner wants comparisons                     |

Authors and the organization are project fields, not skill content, because JSON-LD and the byline need them as data.

## Kind skills

Every page kind (`page_kinds`) points to a skill that says how to write such a page: structure, length, what it must contain, what to avoid. A new project gets three kinds with ready skills:

| Kind       | What the starter skill sets                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blog       | the answer in the first paragraph, headings as questions, an FAQ at the end, sources, 1200 to 2000 words                                               |
| Guide      | the problem, the steps in order, what can go wrong, an FAQ, links to the customer's pages that help with a step                                        |
| Comparison | a feature table with facts only from the product skill and the competitor's pages, an honest "when to choose the other", no judgments without a source |

The owner edits these skills like any other and adds kinds with their own skills.

## Custom skills

Any number. Anything the owner wants the model to know or do: a glossary of terms, linking rules, forbidden topics, examples of good paragraphs.

## How the model uses them

Every model call in a run gets the product skill, the kind skill of the page being written and all of the project's custom skills, in full. The check step in [`workflow.md`](workflow.md) lists every claim about the product on the page and for each one points to the sentence in the skills that confirms it; a claim without such a sentence stops the page.

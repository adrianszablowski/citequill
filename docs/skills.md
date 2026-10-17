# Skills

A skill is the model's only source of knowledge about the customer's product and about how to write for it. The owner edits every skill in the Skills section: its name, its description and the body in a text field. A change takes effect from the next run. There is no version history.

## Format

Markdown with frontmatter, like SKILL.md in Claude Code:

```markdown
---
name: Plans and prices
description: Every plan of Acme with its price and what it includes; read before writing about cost.
---

| Plan | Price | Includes |
...
```

`name` and `description` identify the skill in the list in the dashboard and in prompts. The description says what the skill holds and when a writer needs it, so a step can pick skills from a list by their descriptions. The content is free. In the database they are three columns; the frontmatter is rendered when the skill goes into a prompt.

## Folders

The Skills section shows three folders of tiles. A tile opens the skill on its own page. The folder of a skill comes from the data, with no column of its own:

| Folder     | What is in it                                                                                           | How a skill gets there                 |
| ---------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Product    | the ten product skills below, written by the crawl                                                      | `skills.is_product`                    |
| Page kinds | one skill per page kind, saying how to write such a page                                                | a `page_kinds` row points to the skill |
| Custom     | anything else the owner wants the model to know: a glossary, linking rules, examples of good paragraphs | neither of the above                   |

## Product skills

The crawl writes ten product skills when a site is connected, one per topic, and the owner corrects them. The topics are fixed, because the writer, the checker and the report look for specific things in them:

| Skill                | What is in it                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it is           | the product and its category in one or two sentences, then the facts the site gives about the company: legal name, founding year, where it is, who runs it, how it places itself against alternatives                                                                                                                                                                                                                       |
| Who it is for        | the audiences, their roles and problems, the words the site uses for them, the outcomes it promises them                                                                                                                                                                                                                                                                                                                    |
| What it does         | products and services, features, integrations, platforms, limits, use cases, with the numbers the site gives, and the content the site publishes                                                                                                                                                                                                                                                                            |
| Plans and prices     | every plan with its price, period, currency and what it includes; the free tier or trial; refunds and guarantees; support, security and compliance                                                                                                                                                                                                                                                                          |
| Proof                | customers named on the site, numbers, testimonials with who said them, case studies with their results, awards, press                                                                                                                                                                                                                                                                                                       |
| How we speak         | one section per register of the site's pages (landing, blog, comparison, plan or guide, legal, other) with its tone, grammatical person, formality, sentence and heading length, contractions and humour, and lines quoted from pages of that register; then the rules every page shares: the words the site uses for its product, features and users, how it spells and capitalises its names, units, the terms it defines |
| What we do not claim | the limitations and disclaimers the site states, each naming its subject (the app, the website, a calculator): functions it does not have, promises it does not make, comparisons it avoids                                                                                                                                                                                                                                 |
| Questions people ask | the questions the site answers, from FAQ pages and sections, each with its short answer                                                                                                                                                                                                                                                                                                                                     |
| Languages            | the site's languages with the address of each version and which one is the main language the crawl read; written from the locales the crawl found in `hreflang`, without a model call                                                                                                                                                                                                                                       |
| Competitors          | who they are and how they differ, in the site's own words, when the owner wants comparisons                                                                                                                                                                                                                                                                                                                                 |

Every skill holds only what the site says, as positive statements about the site or the product. The crawl reads the site in chunks, so what one page leaves out is a fact about the chunk and never about the site: "no author bylines appear on these pages" has no place in a skill, because a writer would read it as a claim about the whole site. A qualifier such as "only", "main" or "closest" stands on a sentence on the site that says so. A limitation names its subject, because What we do not claim goes into every writing call: "the app has no plate calculator" lets a writer link to the plate calculator on the website, where "no plate calculator" would make them deny it. Questions people ask holds one answer per question, even when two pages word it differently. The crawl reads the site in its main language, so nine skills describe the site in that language, and Languages lists the other versions from data rather than from pages. A skill the crawl found nothing for has the one sentence "Not found on the site." as its body and a description that says so, so the owner sees the gap and fills it. Authors and the organization are project fields, not skill content, because JSON-LD and the byline need them as data; the skills name the company in prose, the fields come with the publishing step that writes the JSON-LD.

Ten skills and not one document, because each one fits in one model answer, each carries a description a writer can pick it by, the owner edits the one that is wrong, and a writer who reads one 25 000 character document loses the sentence it needs in the rest.

## Kind skills

Every page kind (`page_kinds`) points to a skill that says how to write such a page: what the page has, in what order, where its facts come from, and what done means. A new project gets three kinds with ready skills:

| Kind       | What the starter skill sets                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blog       | the answer in the first paragraph, headings as questions, an FAQ and sources in their fields, 1200 to 2000 words                                       |
| Guide      | the problem, the steps in order, what can go wrong, an FAQ in its field, links to the customer's pages that help with a step                           |
| Comparison | a feature table with facts only from the product skills and the competitor's pages, an honest "when to choose the other", every judgment with a source |

A kind skill states every rule as a target, never as a prohibition: "the text speaks as the customer" where "never say a model wrote it" would pull that very thing into the model's attention. Its Voice section names the register of How we speak the kind writes in: Blog the blog register, Guide the plan or guide register, Comparison the comparison register, so a post does not borrow the landing page's hooks. It ends with the criteria the page is done by, so the writer can tell done from not done. The owner edits these skills like any other and adds kinds with their own skills.

## Custom skills

Any number. Anything the owner wants the model to know or do: a glossary of terms, linking rules, topics to leave out, examples of good paragraphs.

## How the model uses them

Every model call in a run gets the kind skill of the page being written and all of the project's custom skills, in full. Of the product skills, every call gets What it is, How we speak and What we do not claim. The brief step reads the descriptions of the other seven and names the ones the page needs, and the writing step gets those in full. The check step gets all ten, because it looks for the sentence that confirms a claim wherever it is: it lists every claim about the product on the page and for each one points to the sentence in the skills that confirms it, and a claim without such a sentence stops the page. The steps are in [`workflow.md`](workflow.md).

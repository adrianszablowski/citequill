# Workflow

Four processes: crawl on connection, weekly run, page on demand and publishing. Every step ends with a criterion that shows it is done. Processes that call the model run as a Vercel Workflow; the cron on Vercel is thin and only starts the run.

## Models and cost

| Task                                                 | Model                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Writing pages, briefs, the product skill, the report | Opus 5.5                                                      |
| Extracting facts from the crawl, checking claims     | Sonnet 5.5                                                    |
| Web research                                         | the web search tool in the Anthropic API, called by the model |

The Anthropic SDK directly, one key `ANTHROPIC_API_KEY`. Every call adds its input and output tokens and cost to its row in `runs`.

## Crawl on connection

Input: the project's domain.

1. Fetch `robots.txt`, the sitemaps it lists and `/sitemap.xml`, and `llms.txt`. Done when there is a list of page URLs or it is known that there is no sitemap; then the list is the home page and the links from it to the same domain.
2. Fetch up to 50 pages, starting with the home page, then in order from the sitemap. When `llms.txt` or the headers point to a markdown version, take it; otherwise convert the HTML to markdown. Save to `crawled_pages`. Done when every page on the list has a row or a saved error.
3. Read the locales from `hreflang` and `<html lang>`; for each locale work out the base URL. Save to `project_locales`. Done when there is at least one locale with a base URL and one is the default.
4. Sonnet extracts facts from `crawled_pages`: product, audience, features, prices, platforms, what the site does not promise, tone, competitors named on the site. Done when every fact has the URL of the page it comes from.
5. Opus writes the product skill with the fixed headings from [`skills.md`](skills.md), only from the facts from step 4. Save to `skills` with `is_product`. Done when every heading has content or the sentence "not found on the site".
6. Create the three starter kinds with the skills from [`skills.md`](skills.md). Guess the URL prefix of each kind from the URLs in `crawled_pages` (for example `/blog`, `/compare`), and when there is nothing to go on, leave it empty to be filled in. Save the first author from the `author` fields in the crawl, or empty to be filled in. Done when the project has three kinds and the dashboard shows what the owner still has to fill in.

After the crawl the dashboard leads the owner to the product skill and asks them to review it. The owner can run the crawl again; it overwrites `crawled_pages` and `project_locales` and leaves the skills alone.

## Weekly run

Start: the cron at the project's run hour starts one Workflow per project. Input: the project, its skills, `pages_per_week`.

1. Context. Gather the skills, the titles and paths of pages from `crawled_pages` and published `pages`, the queries from `search_console_rows` from the last 28 days when there are any, and the list of competitors. Done when there is one context document.
2. Topic research. Opus with web search looks for the questions the audience asks, competitors' topics and changes in the industry, and picks exactly `pages_per_week` topics. Every topic has a kind, reasoning, sources and a sentence on why no existing page covers it. Save to `runs.plan`. Done when there are as many topics as needed, each complete.
3. Brief. For each topic Opus writes a brief shared across locales: intent, the answer in one sentence, a heading outline, facts from the skills, sources, the customer's pages to link to, length from the kind skill. Done when every topic has a brief.
4. Writing. For each brief and each locale Opus writes the page: `title`, `meta_title`, `meta_description`, `excerpt`, `slug`, `tags`, `faq`, `body_md` with internal links to the customer's pages and, when enabled, links to sources. Save as `draft` in one `translation_group_id`. Done when every locale of every topic has a row.
5. The check. Sonnet lists every claim about the product on the page and for each one points to the sentence in the skills that confirms it. It also checks that the internal links lead to existing pages and that the text does not speak of itself as the model's text. On a finding, Opus corrects the page once with the list of findings and Sonnet checks again. Done when every page has a result: clean, or a `check_note` with the list of findings.
6. Outcome. In auto mode every clean translation group goes to publishing from the ["Publishing" section](#publishing); pages with a `check_note` stay drafts. In drafts mode everything stays a draft. Done when `runs.status` is `finished` and the cost is summed.
7. Report. Opus writes the weekly report from data: the pages published with links, the drafts with a `check_note`, events on Citequill pages since the previous report by `referrer_group`, `search_console_rows` when there are any, the cost of the run. Save to `reports`. Done when the report is in the Reports tab.

A run that fails has `status` `failed` and an `error`; the report for that week says the run failed.

## Page on demand

The "Write a page" button with a topic and a kind creates a `manual` run and starts the same Workflow from step 3 with one topic. Without step 7. The outcome depends on the project's mode as in step 6.

## Publishing

One function, called by the run in auto mode and by Publish in the dashboard. For each page of the translation group:

1. Render `body_html` from `body_md` with one renderer: ids on headings, anchors on FAQ questions.
2. Set `status` `published` and `published_at`; on a later publishing of the same page only `updated_at`.
3. Send the webhook with the `published` or `updated` event when the project has a URL. The format is in [`content-api.md`](content-api.md).
4. Ping IndexNow with the page's full URL when the key file on the domain responds.

Unpublishing in the dashboard: the owner picks 410 or a redirect URL. The page gets `status` `unpublished`, `unpublished_at`, `redirect_to`, and the webhook gets the `unpublished` event. The API stops returning it in the list and the sitemap, and starts returning it in the redirects.

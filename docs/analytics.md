# Analytics

Two sources, two sets of data. Citequill's own script measures traffic on the site and the data is visible live. Queries, impressions and positions in Google come only from Search Console, with a delay of 2 to 3 days, and only in projects that have connected it.

## Script

The snippet from Settings, for the `<head>` of the customer's site:

```html
<script
    defer
    data-site="<site_id>"
    src="https://citequill.com/js/script.js"
></script>
```

The script sends a `pageview` event on load and on every URL change in a single-page application (`pushState`, `popstate`). The event carries the path, the referrer and the `utm_source`, `utm_medium`, `utm_campaign` parameters from the URL. Custom events:

```js
citequill('event', 'signup');
citequill('event', 'purchase', { amount: 49, currency: 'PLN' });
```

The script stores nothing in the browser: no cookies, no `localStorage`. The customer's site does not need a consent banner because of it.

## Endpoint

`POST https://citequill.com/api/v1/events`, public, JSON body from the script. The server:

1. Checks that `site_id` exists and that the `Origin` header belongs to the project's domain. Otherwise 204 without saving, so the script does not report errors on foreign sites.
2. Rejects the user agents of known bots.
3. Computes `visitor_hash` as in [`data-model.md`](data-model.md), takes the country from the `x-vercel-ip-country` header, classifies the referrer into a group, matches the path to a Citequill page by `page_id`.
4. Saves to `events` and responds 204.

## Referrer groups

| Group    | Domains                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `search` | google, bing, duckduckgo, yahoo, yandex, baidu, ecosia, brave                                                                                |
| `ai`     | chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com, you.com, poe.com, meta.ai, chat.mistral.ai |
| `social` | facebook, instagram, x.com, twitter, linkedin, reddit, tiktok, youtube, threads, pinterest                                                   |
| `direct` | empty referrer                                                                                                                               |
| `site`   | any other domain                                                                                                                             |

The domain list is one constant in the code. A new AI assistant is a new row there and here.

## The Analytics tab

A date range (default 7 days) and the "Citequill pages only" filter, which narrows everything to events with a `page_id`.

- Now: visitors from the last 5 minutes.
- Pageviews and visitors over time: a chart by hour for a range up to 2 days, by day for longer.
- Pages: paths by pageviews.
- Sources: groups, and within each the domains by pageviews. The `ai` group is always visible, even with zero.
- Countries by pageviews.
- Custom events: name, count, split by source group.
- UTM: campaigns by pageviews.

Data is read from `events` in Supabase. When the queries stop fitting in a second, the columnar database from the backlog comes in.

## Search Console

The owner adds the Citequill service account address (shown in Settings) as a full user of the property and enters the property address in the project. No OAuth.

A cron job once a day, for every project with a property, pulls the rows from the last 3 available days in the dimensions date, query, page and country and saves them to `search_console_rows`, overwriting, because Google corrects the data for about 3 days. The API limit is 1,200 requests per minute per Google project; one Citequill project uses a few.

The Analytics tab shows from these rows, for the whole domain and for Citequill pages: queries with clicks, impressions and position, pages by clicks, countries. The weekly run takes the queries from the last 28 days as input to the research.

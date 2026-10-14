# What Google's rules, the law and the evidence say about autopilot content

Research date: 13 October 2026. Digest of a sub-agent report. Primary means Google, a statute, a court or the person the claim is about.

## The point first

Google's gen-AI page says: "It is critical to manually factcheck and review all AI-generated content for accuracy and trustworthiness before publishing." It applies to title, meta description, structured data and alt text too. https://developers.google.com/search/docs/fundamentals/using-gen-ai-content (added 21 May 2025, revised 1 October 2026). A product that publishes with no human review runs against that line. Google does not ban AI content and rewards helpful content however made.

Documented failures share one pattern: hundreds or thousands of thin, unoriginal pages, fast, unedited. Documented wins are self-reported.

## Spam policies (last updated 28 August 2026)

https://developers.google.com/search/docs/essentials/spam-policies

- Scaled content abuse (introduced 5 March 2024): "many pages are generated for the primary purpose of manipulating search rankings and not helping users", "no matter how it's created". Examples include "Using generative AI tools or other similar tools to generate many pages without adding value for users".
- Site reputation policy: presumption that "individual pages (including new pages) match the overall quality of other pages on the domain". A thin batch lowers the presumed quality of the whole site. EEA split since 30 August 2026.
- Link spam: "Excessive link exchanges" and "Using automated programs or services to create links to your site" are listed. Paid links need rel=nofollow or rel=sponsored.
- Doorway abuse: "substantially similar pages that are closer to search results than a clearly defined, browseable hierarchy". "X for Y" families that differ by one noun fit this.
- 15 May 2026: spam definition extended to "attempting to manipulate generative AI responses in Google Search".

## AI content guidance

- 2023 post: "Using AI doesn't give content any special gains. It's just content." Bylines where readers would ask "Who wrote this?". Disclosure where they would ask "How was this created?". Do not list the AI as author. https://developers.google.com/search/blog/2023/02/google-search-and-ai-content
- Helpful content self-assessment asks: "Are you using extensive automation to produce content on many topics?", "Is the use of automation, including AI-generation, self-evident to visitors?", "Does the content provide original information, reporting, research, or analysis?". https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Rater guidelines 4.6.5 and 4.6.6: Lowest for main content "created with little to no effort, little to no originality, and little to no added value".
- AI features: "no additional requirements" to appear in AI Overviews or AI Mode. https://developers.google.com/search/docs/appearance/ai-features

## Evidence on outcomes

| Case | What | Outcome | Reliability |
| --- | --- | --- | --- |
| March 2024 wave | 49,345 sites tracked by Ian Nuttall | 837 deindexed (1.7%); Originality.ai: 1,446 of about 79,000 (1.9%), 86% of top deindexed likely used AI | secondary, https://www.searchenginejournal.com/googles-march-2024-core-update-impact-hundreds-of-websites-deindexed/510981/ |
| Tailride (GetInvoice) | 22,000 scraped and rewritten pages in months | 130 clicks a day to zero on 28 February 2025, no manual action, indexed pages 20,000 to 1, deleting did not help, relaunched on new domain | first-hand, https://tailride.so/blog/google-penalty-22000-ai-pages |
| Martin Schenk | 2,300 auto-published articles over 16 months | clicks 695 to 69, position 13 to 32; "Auto-publish is the single root cause" | first-hand, https://dev.to/martinschenk/i-auto-published-2300-ai-articles-google-buried-90-of-my-traffic-424o |
| Causal via Byword | about 1,800 articles from a competitor's URLs | peak 610,000 visits then 190,000 by December 2023 | secondary |
| Reddit AI translations | auto-translated threads | heavy visibility loss in IT, ES, DE, FR after May and June 2026 updates | secondary, https://www.gsqi.com/marketing-blog/reddit-ai-translations-drop/ |
| CNET | 77 AI finance explainers | corrections on 41 of 77 | secondary |
| Ahrefs study, July 2025 | 600,000 top-20 pages | correlation between AI share and position 0.011; pure AI "rarely reaches #1" | vendor research |

No checkable case ties SEObot, Outrank, RankYak, Byword or Journalist AI to a penalty or a verified gain.

## What kept traffic

Original information and first-hand evidence, topical focus and real expertise, fewer pages published slower, named authors, internal links, editing and fact-checking. Tailride rebuilt with one human-edited page a day.

## Comparison pages and the law

Lawful in the EU and Poland when accurate, objective, verifiable and not misleading. Directive 2006/114/EC article 4; Polish ustawa o zwalczaniu nieuczciwej konkurencji art. 16 ust. 3 (8 conditions, including comparing "w sposób rzetelny i dający się zweryfikować na podstawie obiektywnych kryteriów", price allowed, no exploiting "renomy znaku towarowego"). A wrong competitor price is a misleading action under UCPD article 6(1)(d). Trade marks may be used to identify the competitor (O2 v Hutchison, C-533/06); presenting a product as an imitation is unlawful (L'Oréal v Bellure, C-487/07). The ASA Lidl ruling shows the accepted pattern: dated small print and a verification page. https://lexlege.pl/ustawa-o-zwalczaniu-nieuczciwej-konkurencji/art-16/, https://www.asa.org.uk/rulings/lidl-great-britain-ltd-a21-1112122-lidl-great-britain-ltd.html

## Rules a product like this should enforce

1. Nothing publishes without a human reading it, or the vendor's own editors are the review (Google gen-AI page).
2. Review title, meta description, structured data and alt text too.
3. Every page adds something not on the source pages: original data, a measurement, a working tool, first-hand evidence.
4. Stay inside the customer's topic.
5. Treat volume as risk. Few pages a week, more only once earlier pages earn impressions.
6. No "X for Y" families that differ by one swapped word. Check Search Console for pages already shown for the target query; consolidate with canonical or redirect.
7. Cite sources on factual claims and verify against the source.
8. Say nothing about the customer's product that the customer's own site does not say.
9. Competitor facts carry the competitor's name, a check date and a link to the competitor's pricing page.
10. Never call a competitor's product an imitation.
11. Re-check competitor prices on a schedule and remove any figure you cannot re-verify.
12. Named human author on every page and disclosure of automation. Not the AI as author.
13. No link exchanges, no automated link building, rel=sponsored on paid links.
14. Monitor Search Console for manual actions and query overlap; stop publishing when a batch gets no impressions.
15. Do not host pages under a third party's domain to borrow rankings.

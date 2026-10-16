# Research behind the copy rules

Checked in October 2026. Read it when you want the reason for a rule, or when a request seems to contradict one. Each finding is labelled: evidence (a controlled test, an eyetracking or usability study, or a large dataset), case study (one test, often a vendor's), or opinion (a practitioner or a platform, no published method).

## Lines that read as machine-written

- Wikipedia's WikiProject AI Cleanup keeps a descriptive list of signs: inflated significance ("stands as a testament", "pivotal role", "underscores"), promotional vocabulary ("vibrant", "groundbreaking", "boasts"), vague attributions ("experts argue"), negative parallelisms ("not just X, but Y", "not X, but Y", "Y rather than X"), the rule of three, avoided copulas ("serves as" for "is"), trailing "-ing" clauses ("ensuring…", "highlighting…"), Title Case headings, bold overuse, em dashes (listed as outdated since September 2026 because models changed, still a tell to readers), and chatbot leftovers. The vocabulary shifts by model era, so a single word proves nothing; a cluster does. Opinion from a large editing community, with examples. [Wikipedia, 'Signs of AI writing', read October 2026](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
- Practitioners agree that banning patterns in the prompt helps but does not finish the job; the fix is specificity, varied sentence length and a concrete voice, then an editing pass. Opinion. [Kalungi, 'Prompt AI for better marketing copy'](https://www.kalungi.com/blog/prompt-ai-for-better-marketing-copy)

Used in: Voice in `SKILL.md`, sweeps 1 to 3 and 7.

## Plain, specific wording

- Rewriting a site to be concise, scannable and objective made it 124% more usable; users disliked marketing language. Evidence: controlled, 51 users, old. [NN/g, 'Concise, scannable, and objective', 1997](https://www.nngroup.com/articles/concise-scannable-and-objective-how-to-write-for-the-web/)
- Experts also prefer plain summaries. Evidence: qualitative, 4 people. [NN/g, 'Plain language is for everyone, even experts', 2017](https://www.nngroup.com/articles/plain-language-experts/)
- Landing pages at a 5th to 7th grade reading level converted at 11.1%, against 5.3% for professional-level pages; for SaaS 12.9% against 2.1%. Evidence: correlation, 41,000 pages. [Unbounce, 'Conversion benchmark report', 2024](https://unbounce.com/conversion-benchmark-report/)
- Concrete language made customers more satisfied and more willing to buy. Evidence: 5 studies, service conversations. [Packard and Berger, Journal of Consumer Research, 2021, summary by Wharton](https://knowledge.wharton.upenn.edu/article/how-language-boosts-customer-satisfaction/)
- A homepage should open with a line that says what the product does; a clever slogan fails to say what users gain. Opinion. [NN/g, 'Top 10 guidelines for homepage usability', 2002](https://www.nngroup.com/articles/top-ten-guidelines-for-homepage-usability/)

Used in: Voice, Landing page and metadata.

## Errors

- Show the error beside its source, with more than colour. Use plain language, say precisely what happened, offer the next step. Avoid "invalid", "illegal", "incorrect" and any wording that blames the reader; frame the message around what the system needs. Keep what the reader typed. No humour in routine errors. Opinion from a research body, with examples. [NN/g, 'Error message guidelines', 2024](https://www.nngroup.com/articles/error-message-guidelines/)

Used in: Errors, sweep 5.

## Empty states

- Tell the reader whether the emptiness is real or still loading. Give a direct path to the task that fills the area, as a link or button, not a description. Keep guidance brief and in place, never a forced tutorial: "Star your favorites to list them here". Opinion from a research body, with examples. [NN/g, 'Empty state interface design', 2023](https://www.nngroup.com/articles/empty-state-interface-design/)

Used in: Empty states, sweep 6.

## Pending states

- A pending link shows subtle inline feedback while navigation completes, at a fixed size, toggled by opacity so nothing shifts; a prefetched route may skip the pending phase. Official. Next.js 16.4 docs, `useLinkStatus`, in `node_modules/next/dist/docs`.
- A form's pending state comes from `useFormStatus` in a component rendered inside the form. Official. Next.js 16.4 docs, 'Forms'.

Used in: Buttons and menu items.

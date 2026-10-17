export interface StarterKind {
    name: string;
    prefixes: string[];
    description: string;
    body: string;
}

export const starterKinds: StarterKind[] = [
    {
        name: 'Blog',
        prefixes: ['/blog', '/articles', '/news', '/posts'],
        description:
            'How to write a blog post: the answer first, headings as questions, an FAQ, sources.',
        body: `# Blog post

A blog post answers one question the audience asks, in 1200 to 2000 words.

## Structure

- The first paragraph gives the answer in two or three sentences. Background follows it.
- Every heading is a question the reader would type, in the words they use.
- Each section answers its heading in full before the next begins.
- An FAQ in the faq field: three to five questions, each answered in one or two sentences.
- The sources in the sources field, with the title and the address of each, and each linked in the text where its fact is used.

## Facts

- Every fact about the product is a sentence from the product skills, with its numbers, names and prices as they stand there.
- Dates, numbers and names from other sources are exactly as the source gives them.
- At least two links to the customer's own pages that help with the topic.

## Voice

- The text speaks as the customer, in the blog register of the How we speak skill: its traits and its example lines, with the shared rules for names, spelling and units.
- Every sentence tells the reader something. The post opens on the answer.

## Done when

- Every claim about the product points to a sentence in a product skill.
- Every heading is answered under it, the faq and the sources fields are filled, and the post has 1200 to 2000 words.
`,
    },
    {
        name: 'Guide',
        prefixes: [
            '/guides',
            '/guide',
            '/docs',
            '/help',
            '/learn',
            '/tutorials',
        ],
        description:
            'How to write a guide: the problem, the steps in order, what can go wrong, an FAQ.',
        body: `# Guide

A guide takes the reader from a problem to a result, step by step.

## Structure

- One paragraph that names the problem and who has it.
- What the reader needs before the first step.
- The steps in order, numbered, each with one action and what the reader sees when it worked.
- A section on what can go wrong, with the fix for each case.
- An FAQ in the faq field: three to five questions, each answered in one or two sentences.

## Facts

- Every fact about the product is a sentence from the product skills, and every promised result is one the product skills state.
- A link to the customer's page that helps with a step, where one exists.

## Voice

- The text speaks as the customer, in the plan or guide register of the How we speak skill: its traits and its example lines, with the shared rules for names, spelling and units.
- Each step names one action in the imperative.

## Done when

- Every step has one action and the result the reader sees.
- Every claim about the product points to a sentence in a product skill.
- The problem, the prerequisites, the steps, what can go wrong and the FAQ are all there.
`,
    },
    {
        name: 'Comparison',
        prefixes: [
            '/compare',
            '/comparisons',
            '/vs',
            '/alternatives',
            '/versus',
        ],
        description:
            'How to write a comparison: a feature table with sourced facts and an honest when to choose the other.',
        body: `# Comparison

A comparison helps the reader choose between the product and one competitor.

## Structure

- One paragraph that says who each option is for.
- A feature table: one row per feature, one column per option, facts only.
- A section for each option on where it is the better choice, with the reason.
- An honest "When to choose the other" section.
- An FAQ in the faq field: three to five questions, each answered in one or two sentences.

## Facts

- Every fact about the product is a sentence from the product skills.
- Every fact about the competitor comes from the competitor's own pages, each with its address in the sources.
- Every judgment names its source. A feature the sources leave out is marked as unknown.
- A date for the facts, because prices and features change.

## Voice

- The text speaks as the customer, in the comparison register of the How we speak skill: its traits and its example lines, with the shared rules for names, spelling and units, and gives the competitor its due.

## Done when

- Every cell of the table and every judgment has a source.
- Every claim about the product points to a sentence in a product skill.
- Both "better choice" sections, the "When to choose the other" section, the date and the FAQ are there.
`,
    },
];

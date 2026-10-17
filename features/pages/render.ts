import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

export function renderMarkdown(markdown: string) {
    const file = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeSlug)
        .use(rehypeSanitize, schema)
        .use(rehypeStringify)
        .processSync(markdown);

    return String(file);
}

// GitHub's schema prefixes every id with "user-content-"; the ids here come
// from rehype-slug, letters and hyphens only, and a customer's site links to
// a heading as #heading.
const schema = { ...defaultSchema, clobberPrefix: '' };

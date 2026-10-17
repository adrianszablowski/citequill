'use client';

import { type Control, useWatch } from 'react-hook-form';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { pagePath, readingMinutes } from '@/features/pages/draft';
import type { Page } from '@/features/pages/queries';
import { renderMarkdown } from '@/features/pages/render';
import {
    faqItems,
    type PageValues,
    sourceItems,
} from '@/features/pages/schema';

interface PagePreviewProps {
    page: Page;
    control: Control<PageValues>;
}

export default function PagePreview({
    page,
    control,
}: Readonly<PagePreviewProps>) {
    const [title, bodyMd] = useWatch({ control, name: ['title', 'body_md'] });

    const html = renderMarkdown(bodyMd);

    const faq = faqItems.safeParse(page.faq).data ?? [];

    const sources = sourceItems.safeParse(page.sources).data ?? [];

    return (
        <article className="mx-auto prose prose-neutral dark:prose-invert prose-h2:mt-8 prose-h2:mb-3 prose-h3:mt-6 prose-h3:mb-2 prose-p:my-4 prose-p:leading-relaxed prose-ol:my-4 prose-ul:my-4 prose-li:my-1 prose-li:leading-relaxed">
            <p className="text-sm text-muted-foreground">
                {page.page_kinds?.name ?? 'Page'} in {page.locale},{' '}
                {readingMinutes(bodyMd)} min read, at{' '}
                {pagePath('', page.page_kinds?.url_prefix ?? '', page.slug)}
            </p>
            <h1>{title}</h1>
            <div dangerouslySetInnerHTML={{ __html: html }} />
            {faq.length > 0 && (
                <>
                    <h2>FAQ</h2>
                    <Accordion className="not-prose">
                        {faq.map((item) => (
                            <AccordionItem
                                key={item.question}
                                value={item.question}
                            >
                                <AccordionTrigger>
                                    {item.question}
                                </AccordionTrigger>
                                <AccordionContent>
                                    {item.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </>
            )}
            {sources.length > 0 && (
                <>
                    <h2>Sources</h2>
                    <ul>
                        {sources.map((source) => {
                            const host = webHost(source.url);

                            return (
                                <li key={source.url}>
                                    {host ? (
                                        <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {source.title}
                                        </a>
                                    ) : (
                                        source.title
                                    )}
                                    {host && (
                                        <span className="text-muted-foreground">
                                            {' '}
                                            {host}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </article>
    );
}

function webHost(url: string) {
    try {
        const { protocol, hostname } = new URL(url);

        return protocol === 'https:' || protocol === 'http:' ? hostname : null;
    } catch {
        return null;
    }
}

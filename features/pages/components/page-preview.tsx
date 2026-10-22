'use client';

import { type Control, useWatch } from 'react-hook-form';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { pagePath, readingMinutes } from '@/features/pages/draft';
import { renderMarkdown } from '@/features/pages/render';
import type { PageValues } from '@/features/pages/schema';
import { isWebUrl } from '@/lib/utils';

interface PagePreviewProps {
    control: Control<PageValues>;
    locale: string;
    kindName: string;
    urlPrefix: string;
    livePath: string | null;
}

export default function PagePreview({
    control,
    locale,
    kindName,
    urlPrefix,
    livePath,
}: Readonly<PagePreviewProps>) {
    const [title, slug, bodyMd, faq, sources] = useWatch({
        control,
        name: ['title', 'slug', 'body_md', 'faq', 'sources'],
    });

    const { html, wordCount } = renderMarkdown(bodyMd, locale);

    return (
        <article className="mx-auto prose prose-neutral dark:prose-invert prose-h2:mt-8 prose-h2:mb-3 prose-h3:mt-6 prose-h3:mb-2 prose-p:my-4 prose-p:leading-relaxed prose-ol:my-4 prose-ul:my-4 prose-li:my-1 prose-li:leading-relaxed">
            <p className="text-sm text-muted-foreground">
                {kindName} in {locale}, {readingMinutes(wordCount)} min read, at{' '}
                {livePath ?? pagePath('', urlPrefix, slug)}
            </p>
            <h1>{title}</h1>
            <div dangerouslySetInnerHTML={{ __html: html }} />
            {faq.length > 0 && (
                <>
                    <h2>FAQ</h2>
                    <Accordion className="not-prose">
                        {faq.map((item, index) => (
                            <AccordionItem key={index} value={index}>
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
                        {sources.map((source, index) => {
                            const host = isWebUrl(source.url)
                                ? new URL(source.url).hostname
                                : null;

                            return (
                                <li key={index}>
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

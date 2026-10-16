import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { Page } from '@/features/pages/queries';
import { renderMarkdown } from '@/features/pages/render';

interface PagePreviewProps {
    page: Page;
}

export default async function PagePreview({
    page,
}: Readonly<PagePreviewProps>) {
    const html = await renderMarkdown(page.body_md);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                    {page.page_kinds?.name ?? 'Page'} in {page.locale},{' '}
                    {page.reading_minutes} min read, at /
                    {[page.page_kinds?.url_prefix, page.slug]
                        .map((part) => part?.replace(/^\/+|\/+$/g, '') ?? '')
                        .filter(Boolean)
                        .join('/')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <article className="prose prose-sm max-w-none dark:prose-invert">
                    <h1>{page.title}</h1>
                    <p className="lead">{page.excerpt}</p>
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </article>
            </CardContent>
        </Card>
    );
}

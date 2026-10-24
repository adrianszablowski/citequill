import Link from 'next/link';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { examples } from '@/features/content-api/examples';
import CopyButton from '@/features/projects/components/copy-button';

interface ApiExamplesProps {
    siteId: string;
    locale?: string;
}

export default function ApiExamples({
    siteId,
    locale,
}: Readonly<ApiExamplesProps>) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Read the pages</CardTitle>
                <CardDescription>
                    The examples of the guide, with your site id. Each reads the
                    key from CITEQUILL_KEY on your server.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {examples(siteId, locale).map((example) => (
                    <div key={example.id} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-medium">
                                {example.title}
                            </h3>
                            <CopyButton
                                value={example.code}
                                label={`Copy the example: ${example.title}`}
                            />
                        </div>
                        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                            <code>{example.code}</code>
                        </pre>
                    </div>
                ))}
                <Link
                    href="/docs"
                    className="text-sm underline underline-offset-4"
                >
                    The Content API guide
                </Link>
            </CardContent>
        </Card>
    );
}

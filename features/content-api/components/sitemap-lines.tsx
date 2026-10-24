import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { hostSitemapUrl } from '@/features/content-api/urls';
import CopyButton from '@/features/projects/components/copy-button';
import NotSet from '@/features/projects/components/not-set';

interface SitemapLinesProps {
    siteId: string;
    hosts: string[];
}

export default function SitemapLines({
    siteId,
    hosts,
}: Readonly<SitemapLinesProps>) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>XML sitemap</CardTitle>
                <CardDescription>
                    Add the line to the robots.txt of its host, and Google finds
                    the live pages with no sitemap code on your site.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {hosts.length === 0 && <NotSet />}
                {hosts.map((host) => {
                    const line = `Sitemap: ${hostSitemapUrl(siteId, host)}`;

                    return (
                        <div key={host} className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium">
                                robots.txt of {host}
                            </h3>
                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                                <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs break-all">
                                    {line}
                                </code>
                                <CopyButton
                                    value={line}
                                    label={`Copy the sitemap line of ${host}`}
                                />
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { getCurrentUser } from '@/features/auth/queries';
import CrawlAgainForm from '@/features/crawl/components/crawl-again-form';
import RefreshPoll from '@/features/crawl/components/refresh-poll';
import { getCrawledPageCount, getLatestCrawl } from '@/features/crawl/queries';
import { getProject } from '@/features/projects/queries';
import { hasProductSkill } from '@/features/skills/queries';
import { sectionHref } from '@/lib/sections';

interface CrawlProgressProps {
    params: Promise<{ id: string }>;
}

export default async function CrawlProgress({
    params,
}: Readonly<CrawlProgressProps>) {
    const { id } = await params;

    await getCurrentUser();

    const project = await getProject(id);

    if (!project) {
        notFound();
    }

    const [crawl, hasSkills] = await Promise.all([
        getLatestCrawl(id),
        hasProductSkill(id),
    ]);

    if (hasSkills && crawl?.status === 'finished') {
        redirect(sectionHref(id, 'skills'));
    }

    const isRunning = crawl?.status === 'running' && !crawl.isStale;

    if (isRunning) {
        const pages = await getCrawledPageCount(id);

        return (
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-xl">
                        Reading {project.domain}
                    </CardTitle>
                    <CardDescription>
                        Citequill reads up to 50 pages of the site, then writes
                        what it learned as the product skills. This takes a few
                        minutes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-3 text-sm">
                    <Spinner />
                    <span>{pagesRead(pages)}</span>
                    <RefreshPoll />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <CardTitle className="text-xl">
                    {crawl ? 'The crawl stopped' : 'The crawl has not run yet'}
                </CardTitle>
                <CardDescription>
                    {stoppedReason(crawl, project.domain)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <CrawlAgainForm projectId={id} />
                {hasSkills && (
                    <Button
                        nativeButton={false}
                        render={<Link href={sectionHref(id, 'skills')} />}
                        variant="ghost"
                    >
                        Open the dashboard
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function stoppedReason(
    crawl: { status: string; error: string | null } | null,
    domain: string,
) {
    if (!crawl) {
        return `Citequill has not read ${domain} yet.`;
    }

    if (crawl.status === 'running') {
        return 'The crawl did not finish in 15 minutes.';
    }

    return crawl.error ?? 'The crawl stopped without a message.';
}

function pagesRead(count: number) {
    if (count === 0) {
        return 'No pages read yet.';
    }

    return count === 1 ? '1 page read so far.' : `${count} pages read so far.`;
}

import { startCrawl } from '@/features/crawl/actions';
import CrawlAgainButton from '@/features/crawl/components/crawl-again-button';

interface CrawlAgainFormProps {
    projectId: string;
}

export default function CrawlAgainForm({
    projectId,
}: Readonly<CrawlAgainFormProps>) {
    async function crawlAgain() {
        'use server';

        await startCrawl(projectId);
    }

    return (
        <form action={crawlAgain}>
            <CrawlAgainButton />
        </form>
    );
}

import { Suspense } from 'react';

import SignOutForm from '@/features/auth/components/sign-out-form';
import CrawlProgress from '@/features/crawl/components/crawl-progress';
import CrawlProgressSkeleton from '@/features/crawl/components/crawl-progress-skeleton';

export default function ConnectProgressPage({
    params,
}: PageProps<'/connect/[id]'>) {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 p-6">
            <Suspense fallback={<CrawlProgressSkeleton />}>
                <CrawlProgress params={params} />
            </Suspense>
            <SignOutForm />
        </main>
    );
}

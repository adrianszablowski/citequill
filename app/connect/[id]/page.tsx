import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import SignOutForm from '@/features/auth/components/sign-out-form';
import CrawlProgress from '@/features/crawl/components/crawl-progress';

export default function ConnectProgressPage({
    params,
}: PageProps<'/connect/[id]'>) {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/40 p-6">
            <Suspense fallback={<Skeleton className="h-48 w-full max-w-sm" />}>
                <CrawlProgress params={params} />
            </Suspense>
            <SignOutForm />
        </main>
    );
}

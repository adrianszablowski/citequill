import { Suspense } from 'react';

import { Spinner } from '@/components/ui/spinner';
import HomeRedirect from '@/features/projects/components/home-redirect';

export default function ProjectsPage() {
    return (
        <Suspense
            fallback={
                <main className="flex flex-1 items-center justify-center">
                    <Spinner />
                </main>
            }
        >
            <HomeRedirect />
        </Suspense>
    );
}

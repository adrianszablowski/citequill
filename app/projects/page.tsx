import { Suspense } from 'react';

import HomeRedirect from '@/features/projects/components/home-redirect';

export default function ProjectsPage() {
    return (
        <Suspense>
            <HomeRedirect />
        </Suspense>
    );
}

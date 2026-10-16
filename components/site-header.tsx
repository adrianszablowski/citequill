import { Suspense } from 'react';

import PageTitle from '@/components/page-title';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export default function SiteHeader() {
    return (
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 h-4 data-vertical:self-auto"
                />
                <Suspense>
                    <PageTitle />
                </Suspense>
            </div>
        </header>
    );
}

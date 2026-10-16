import { Suspense } from 'react';

import SectionNav from '@/components/section-nav';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import SidebarUser from '@/features/auth/components/sidebar-user';
import SidebarProjects from '@/features/projects/components/sidebar-projects';

interface AppSidebarProps {
    params: Promise<{ id: string }>;
}

export default function AppSidebar({ params }: Readonly<AppSidebarProps>) {
    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <Suspense fallback={<Skeleton className="h-12 w-full" />}>
                    <SidebarProjects params={params} />
                </Suspense>
            </SidebarHeader>
            <SidebarContent>
                <Suspense>
                    <SectionNav />
                </Suspense>
            </SidebarContent>
            <SidebarFooter>
                <Suspense fallback={<Skeleton className="h-12 w-full" />}>
                    <SidebarUser />
                </Suspense>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

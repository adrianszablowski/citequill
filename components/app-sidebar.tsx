import { Suspense } from 'react';

import SectionNavSkeleton from '@/components/section-nav-skeleton';
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
import SidebarSections from '@/features/projects/components/sidebar-sections';

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
                <Suspense fallback={<SectionNavSkeleton />}>
                    <SidebarSections params={params} />
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

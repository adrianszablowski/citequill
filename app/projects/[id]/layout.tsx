import { type CSSProperties, Suspense } from 'react';

import AppSidebar from '@/components/app-sidebar';
import SiteHeader from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import ProjectGate from '@/features/projects/components/project-gate';

export default function ProjectLayout({
    children,
    params,
}: LayoutProps<'/projects/[id]'>) {
    return (
        <SidebarProvider
            style={
                {
                    '--sidebar-width': 'calc(var(--spacing) * 72)',
                    '--header-height': 'calc(var(--spacing) * 12)',
                } as CSSProperties
            }
        >
            <Suspense>
                <ProjectGate params={params} />
            </Suspense>
            <AppSidebar params={params} />
            <SidebarInset>
                <SiteHeader />
                <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

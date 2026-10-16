'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import LinkPending from '@/components/link-pending';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { projectSections, sectionHref } from '@/lib/sections';

export default function SectionNav() {
    const { id } = useParams<{ id: string }>();
    const pathname = usePathname();

    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {projectSections.map(({ segment, title, icon: Icon }) => {
                        const href = sectionHref(id, segment);

                        return (
                            <SidebarMenuItem key={segment}>
                                <SidebarMenuButton
                                    isActive={pathname.startsWith(href)}
                                    tooltip={title}
                                    render={<Link href={href} />}
                                >
                                    <Icon />
                                    <span>{title}</span>
                                    <LinkPending />
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

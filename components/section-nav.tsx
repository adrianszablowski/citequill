'use client';

import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import LinkPending from '@/components/link-pending';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { pageListHref } from '@/features/pages/list-query';
import { projectSections, sectionHref } from '@/lib/sections';

interface SectionNavProps {
    projectId: string;
    kinds: { id: string; name: string }[];
}

export default function SectionNav({
    projectId,
    kinds,
}: Readonly<SectionNavProps>) {
    const pathname = usePathname();
    const currentKind = useSearchParams().get('kind');

    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {projectSections.map(({ segment, title, icon: Icon }) => {
                        const href = sectionHref(projectId, segment);
                        const isCurrent = pathname.startsWith(href);

                        if (segment !== 'pages' || kinds.length === 0) {
                            return (
                                <SidebarMenuItem key={segment}>
                                    <SidebarMenuButton
                                        isActive={isCurrent}
                                        tooltip={title}
                                        render={<Link href={href} />}
                                    >
                                        <Icon />
                                        <span>{title}</span>
                                        <LinkPending />
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        }

                        return (
                            <Collapsible
                                key={segment}
                                defaultOpen
                                className="group/collapsible"
                                render={<SidebarMenuItem />}
                            >
                                <CollapsibleTrigger
                                    render={
                                        <SidebarMenuButton tooltip={title} />
                                    }
                                >
                                    <Icon />
                                    <span>{title}</span>
                                    <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        {kinds.map((kind) => (
                                            <SidebarMenuSubItem key={kind.id}>
                                                <SidebarMenuSubButton
                                                    isActive={
                                                        isCurrent &&
                                                        currentKind === kind.id
                                                    }
                                                    render={
                                                        <Link
                                                            href={pageListHref(
                                                                projectId,
                                                                {
                                                                    kind: kind.id,
                                                                },
                                                            )}
                                                        />
                                                    }
                                                >
                                                    <span>{kind.name}</span>
                                                    <LinkPending />
                                                </SidebarMenuSubButton>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

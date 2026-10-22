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
import {
    type ProjectSection,
    projectSections,
    sectionHref,
    settingsHref,
    settingsPages,
} from '@/lib/sections';

interface SectionNavProps {
    projectId: string;
    kinds: { id: string; name: string }[];
}

interface SubEntry {
    title: string;
    href: ReturnType<typeof pageListHref> | ReturnType<typeof settingsHref>;
    isActive: boolean;
}

export default function SectionNav({
    projectId,
    kinds,
}: Readonly<SectionNavProps>) {
    const pathname = usePathname();
    const currentKind = useSearchParams().get('kind');

    const subEntries: Partial<Record<ProjectSection, SubEntry[]>> = {
        pages: kinds.map((kind) => ({
            title: kind.name,
            href: pageListHref(projectId, { kind: kind.id }),
            isActive:
                pathname.startsWith(sectionHref(projectId, 'pages')) &&
                currentKind === kind.id,
        })),
        settings: settingsPages.map((page) => ({
            title: page.title,
            href: settingsHref(projectId, page.segment),
            isActive: pathname === settingsHref(projectId, page.segment),
        })),
    };

    return (
        <SidebarGroup>
            <SidebarGroupContent>
                <SidebarMenu>
                    {projectSections.map(({ segment, title, icon: Icon }) => {
                        const href = sectionHref(projectId, segment);
                        const isCurrent = pathname.startsWith(href);

                        const entries = subEntries[segment] ?? [];

                        if (entries.length === 0) {
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
                                        {entries.map((entry) => (
                                            <SidebarMenuSubItem
                                                key={entry.href}
                                            >
                                                <SidebarMenuSubButton
                                                    isActive={entry.isActive}
                                                    render={
                                                        <Link
                                                            href={entry.href}
                                                        />
                                                    }
                                                >
                                                    <span>{entry.title}</span>
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

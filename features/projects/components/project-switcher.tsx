'use client';

import {
    CheckIcon,
    ChevronsUpDownIcon,
    FeatherIcon,
    PlusIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import type { ProjectListItem } from '@/features/projects/queries';
import { sectionHref } from '@/lib/sections';

interface ProjectSwitcherProps {
    projects: ProjectListItem[];
    currentId: string;
}

export default function ProjectSwitcher({
    projects,
    currentId,
}: Readonly<ProjectSwitcherProps>) {
    const { isMobile } = useSidebar();
    const current = projects.find((project) => project.id === currentId);

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton
                                size="lg"
                                className="aria-expanded:bg-sidebar-accent"
                            />
                        }
                    >
                        <Avatar className="rounded-lg after:rounded-lg">
                            {current?.organization_logo_url && (
                                <AvatarImage
                                    src={current.organization_logo_url}
                                    alt=""
                                    className="rounded-lg object-contain"
                                />
                            )}
                            <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <FeatherIcon className="size-4" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm/tight">
                            <span className="truncate font-medium">
                                {current?.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                Citequill
                            </span>
                        </div>
                        <ChevronsUpDownIcon className="ml-auto size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="min-w-56"
                        align="start"
                        side={isMobile ? 'bottom' : 'right'}
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Projects</DropdownMenuLabel>
                            {projects.map((project) => (
                                <DropdownMenuItem
                                    key={project.id}
                                    render={
                                        <Link
                                            href={sectionHref(
                                                project.id,
                                                'pages',
                                            )}
                                        />
                                    }
                                >
                                    {project.name}
                                    {project.id === currentId && (
                                        <CheckIcon className="ml-auto" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem render={<Link href="/connect" />}>
                            <PlusIcon />
                            Connect a site
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

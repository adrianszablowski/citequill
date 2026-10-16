'use client';

import { EllipsisVerticalIcon, UserRoundIcon } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import SignOutMenuItem from '@/features/auth/components/sign-out-menu-item';

interface NavUserProps {
    email: string;
}

export default function NavUser({ email }: Readonly<NavUserProps>) {
    const { isMobile } = useSidebar();

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
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
                            <UserRoundIcon className="size-4" />
                        </div>
                        <span className="truncate text-sm">{email}</span>
                        <EllipsisVerticalIcon className="ml-auto size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="min-w-56"
                        align="end"
                        side={isMobile ? 'bottom' : 'right'}
                        sideOffset={4}
                    >
                        <SignOutMenuItem />
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

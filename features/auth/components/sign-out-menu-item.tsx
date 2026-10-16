'use client';

import { LogOutIcon } from 'lucide-react';
import { useTransition } from 'react';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { signOut } from '@/features/auth/actions';

export default function SignOutMenuItem() {
    const [isPending, startTransition] = useTransition();

    return (
        <DropdownMenuItem
            closeOnClick={false}
            disabled={isPending}
            onClick={() => startTransition(() => signOut())}
        >
            {isPending ? <Spinner /> : <LogOutIcon />}
            {isPending ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
    );
}

'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function SignOutButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            {pending && <Spinner />}
            {pending ? 'Signing out…' : 'Sign out'}
        </Button>
    );
}

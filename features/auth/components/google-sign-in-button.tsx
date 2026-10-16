'use client';

import { useFormStatus } from 'react-dom';

import GoogleLogo from '@/components/icons/google-logo';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function GoogleSignInButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            variant="outline"
            className="h-11 w-full gap-3 text-base"
            disabled={pending}
        >
            {pending ? <Spinner /> : <GoogleLogo className="size-5" />}
            {pending ? 'Opening Google…' : 'Continue with Google'}
        </Button>
    );
}

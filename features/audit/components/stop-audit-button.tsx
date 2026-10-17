'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function StopAuditButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="w-full sm:w-auto"
        >
            {pending && <Spinner />}
            {pending ? 'Stopping…' : 'Stop the audit'}
        </Button>
    );
}

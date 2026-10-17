'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface RunAuditButtonProps {
    label: string;
}

export default function RunAuditButton({
    label,
}: Readonly<RunAuditButtonProps>) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending && <Spinner />}
            {pending ? 'Running the audit…' : label}
        </Button>
    );
}

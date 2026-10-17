'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface MarkButtonProps {
    label: string;
    isMarked: boolean;
}

export default function MarkButton({
    label,
    isMarked,
}: Readonly<MarkButtonProps>) {
    const { pending } = useFormStatus();
    const pendingLabel = isMarked ? 'Unmarking…' : 'Marking…';

    return (
        <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={pending}
            className="w-full sm:w-auto"
        >
            {pending && <Spinner />}
            {pending ? pendingLabel : label}
        </Button>
    );
}

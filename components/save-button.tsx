'use client';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface SaveButtonProps {
    isPending: boolean;
    isDirty: boolean;
}

export default function SaveButton({
    isPending,
    isDirty,
}: Readonly<SaveButtonProps>) {
    return (
        <Button
            type="submit"
            disabled={isPending || !isDirty}
            className="self-start"
        >
            {isPending && <Spinner />}
            {isPending ? 'Saving…' : 'Save'}
        </Button>
    );
}

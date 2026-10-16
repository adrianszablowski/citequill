'use client';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface SkillSaveButtonProps {
    isPending: boolean;
    isDirty: boolean;
}

export default function SkillSaveButton({
    isPending,
    isDirty,
}: Readonly<SkillSaveButtonProps>) {
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

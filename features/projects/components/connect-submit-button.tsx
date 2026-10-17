'use client';

import { type Control, useFormState } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { ProjectValues } from '@/features/projects/schema';

interface ConnectSubmitButtonProps {
    control: Control<ProjectValues>;
}

export default function ConnectSubmitButton({
    control,
}: Readonly<ConnectSubmitButtonProps>) {
    const { isSubmitting, isSubmitSuccessful } = useFormState({ control });

    // The action redirects and its call settles before the new page is on
    // screen, so a successful submit keeps the button pending.
    const isPending = isSubmitting || isSubmitSuccessful;

    return (
        <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <Spinner />}
            {isPending ? 'Connecting…' : 'Connect'}
        </Button>
    );
}

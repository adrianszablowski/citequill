'use client';

import { type Control, type FieldValues, useFormState } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface SaveButtonProps<T extends FieldValues> {
    control: Control<T>;
}

export default function SaveButton<T extends FieldValues>({
    control,
}: Readonly<SaveButtonProps<T>>) {
    const { isSubmitting, isDirty } = useFormState({ control });

    return (
        <Button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="self-start"
        >
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
    );
}

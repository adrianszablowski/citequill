'use client';

import type { ComponentProps } from 'react';
import { type Control, type FieldValues, useFormState } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface SubmitButtonProps<T extends FieldValues> extends Omit<
    ComponentProps<typeof Button>,
    'type'
> {
    control: Control<T>;
    pendingLabel: string;
}

export default function SubmitButton<T extends FieldValues>({
    control,
    pendingLabel,
    disabled,
    children,
    ...props
}: Readonly<SubmitButtonProps<T>>) {
    const { isSubmitting } = useFormState({ control });

    return (
        <Button type="submit" disabled={isSubmitting || disabled} {...props}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? pendingLabel : children}
        </Button>
    );
}

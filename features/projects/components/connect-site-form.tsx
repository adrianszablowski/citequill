'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createProject } from '@/features/projects/actions';
import ConnectSubmitButton from '@/features/projects/components/connect-submit-button';
import { projectSchema, type ProjectValues } from '@/features/projects/schema';

export default function ConnectSiteForm() {
    const form = useForm<ProjectValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: { domain: '' },
    });

    const [isPending, setIsPending] = useState(false);

    async function onSubmit(values: ProjectValues) {
        setIsPending(true);

        // When the action redirects, this call settles without a value and
        // the button stays pending until the new page is on screen.
        const result = await createProject(values);

        if (result?.error) {
            form.setError('root', { message: result.error });
            setIsPending(false);
        }
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
                <Controller
                    name="domain"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="domain">
                                Site address
                            </FieldLabel>
                            <Input
                                id="domain"
                                aria-invalid={fieldState.invalid}
                                autoComplete="url"
                                autoFocus
                                inputMode="url"
                                placeholder="https://www.yoursite.com"
                                {...field}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                {form.formState.errors.root && (
                    <FieldError errors={[form.formState.errors.root]} />
                )}
                <ConnectSubmitButton isPending={isPending} />
            </FieldGroup>
        </form>
    );
}

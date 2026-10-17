'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
    const {
        control,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(projectSchema),
        defaultValues: { domain: '' },
    });

    async function onSubmit(values: ProjectValues) {
        const result = await createProject(values);

        if (result?.error) {
            setError('root', { message: result.error });
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
                <Controller
                    name="domain"
                    control={control}
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
                {errors.root && <FieldError errors={[errors.root]} />}
                <ConnectSubmitButton control={control} />
            </FieldGroup>
        </form>
    );
}

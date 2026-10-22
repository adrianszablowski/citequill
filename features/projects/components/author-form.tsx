'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import SaveButton from '@/components/save-button';
import SubmitButton from '@/components/submit-button';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createAuthor, updateAuthor } from '@/features/projects/actions';
import { authorSchema, type AuthorValues } from '@/features/projects/schema';

interface AuthorFormProps {
    projectId: string;
    author: { id: string; values: AuthorValues } | null;
    onSaved: () => void;
}

export default function AuthorForm({
    projectId,
    author,
    onSaved,
}: Readonly<AuthorFormProps>) {
    const {
        control,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(authorSchema, undefined, { raw: true }),
        defaultValues: author?.values ?? blank,
    });

    async function onSubmit(values: AuthorValues) {
        const result = author
            ? await updateAuthor(projectId, author.id, values)
            : await createAuthor(projectId, values);

        if ('error' in result) {
            setError('root', { message: result.error });
        } else {
            onSaved();
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
                <Controller
                    name="name"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="author-name">Name</FieldLabel>
                            <Input
                                id="author-name"
                                aria-invalid={fieldState.invalid}
                                placeholder="Jane Kowalska"
                                {...field}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Controller
                    name="title"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="author-title">
                                Title
                            </FieldLabel>
                            <Input
                                id="author-title"
                                aria-invalid={fieldState.invalid}
                                placeholder="Head coach"
                                {...field}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Controller
                    name="url"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="author-url">
                                Profile URL
                            </FieldLabel>
                            <Input
                                id="author-url"
                                type="url"
                                aria-invalid={fieldState.invalid}
                                placeholder="https://www.yoursite.com/team/jane"
                                {...field}
                            />
                            <FieldDescription>
                                The page about the author, on the site or
                                elsewhere.
                            </FieldDescription>
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Controller
                    name="same_as"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="author-same-as">
                                Other profiles
                            </FieldLabel>
                            <Textarea
                                id="author-same-as"
                                aria-invalid={fieldState.invalid}
                                placeholder="https://www.linkedin.com/in/jane-kowalska"
                                {...field}
                            />
                            <FieldDescription>
                                One address a line.
                            </FieldDescription>
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                {errors.root && <FieldError errors={[errors.root]} />}
                {author ? (
                    <SaveButton control={control} />
                ) : (
                    <SubmitButton
                        control={control}
                        pendingLabel="Adding…"
                        className="self-start"
                    >
                        Add the author
                    </SubmitButton>
                )}
            </FieldGroup>
        </form>
    );
}

const blank: AuthorValues = { name: '', title: '', url: '', same_as: '' };

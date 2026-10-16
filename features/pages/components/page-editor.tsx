'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import SaveButton from '@/components/save-button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { updatePage } from '@/features/pages/actions';
import type { Page } from '@/features/pages/queries';
import { pageSchema, type PageValues } from '@/features/pages/schema';

interface PageEditorProps {
    page: Page;
}

export default function PageEditor({ page }: Readonly<PageEditorProps>) {
    const router = useRouter();

    const form = useForm<PageValues>({
        resolver: zodResolver(pageSchema),
        defaultValues: { title: page.title, body_md: page.body_md },
    });

    const [isPending, setIsPending] = useState(false);

    async function onSubmit(values: PageValues) {
        setIsPending(true);

        const result = await updatePage(page.id, values);

        if (result.error) {
            form.setError('root', { message: result.error });
        } else {
            form.reset(result.values);
            router.refresh();
        }

        setIsPending(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{page.title}</CardTitle>
                <CardDescription>
                    {page.check_note
                        ? 'The check found claims the skills do not confirm. Fix them here or in the skills, then the page is yours to publish.'
                        : 'Every claim about the product on this page has a sentence in the skills behind it.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {page.check_note && (
                    <ul className="flex flex-col gap-1 rounded-lg border border-destructive/30 p-3 text-sm">
                        {page.check_note.split('\n').map((finding) => (
                            <li key={finding}>{finding}</li>
                        ))}
                    </ul>
                )}
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="title"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="page-title">
                                        Title
                                    </FieldLabel>
                                    <Input
                                        id="page-title"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="body_md"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="page-body">
                                        Markdown
                                    </FieldLabel>
                                    <Textarea
                                        id="page-body"
                                        aria-invalid={fieldState.invalid}
                                        className="min-h-128 font-mono text-sm"
                                        {...field}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        {form.formState.errors.root && (
                            <FieldError errors={[form.formState.errors.root]} />
                        )}
                        <SaveButton
                            isPending={isPending}
                            isDirty={form.formState.isDirty}
                        />
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}

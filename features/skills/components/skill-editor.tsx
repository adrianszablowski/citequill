'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
import SaveButton from '@/components/save-button';
import { Textarea } from '@/components/ui/textarea';
import { updateSkill } from '@/features/skills/actions';
import type { Skill } from '@/features/skills/queries';
import { skillSchema, type SkillValues } from '@/features/skills/schema';

interface SkillEditorProps {
    skill: Skill;
}

export default function SkillEditor({ skill }: Readonly<SkillEditorProps>) {
    const form = useForm<SkillValues>({
        resolver: zodResolver(skillSchema),
        defaultValues: {
            name: skill.name,
            description: skill.description,
            body: skill.body,
        },
    });

    const [isPending, setIsPending] = useState(false);

    async function onSubmit(values: SkillValues) {
        setIsPending(true);

        const result = await updateSkill(skill.id, values);

        if (result.error) {
            form.setError('root', { message: result.error });
        } else {
            form.reset(result.values);
        }

        setIsPending(false);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{skill.name}</CardTitle>
                {skill.is_product && (
                    <CardDescription>
                        Written from the crawl. Every line here counts as the
                        truth about the site, so check it.
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${skill.id}-name`}>
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id={`${skill.id}-name`}
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
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel
                                        htmlFor={`${skill.id}-description`}
                                    >
                                        Description
                                    </FieldLabel>
                                    <Input
                                        id={`${skill.id}-description`}
                                        aria-invalid={fieldState.invalid}
                                        placeholder="How to write a blog post: the answer first, headings as questions."
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
                            name="body"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${skill.id}-body`}>
                                        Skill
                                    </FieldLabel>
                                    <Textarea
                                        id={`${skill.id}-body`}
                                        aria-invalid={fieldState.invalid}
                                        className="min-h-96 font-mono text-sm"
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

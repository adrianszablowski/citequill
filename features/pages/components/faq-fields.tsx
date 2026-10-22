'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
import { type Control, Controller, useFieldArray } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
    Field,
    FieldError,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PageValues } from '@/features/pages/schema';

interface FaqFieldsProps {
    control: Control<PageValues>;
}

export default function FaqFields({ control }: Readonly<FaqFieldsProps>) {
    const { fields, append, remove } = useFieldArray({ control, name: 'faq' });

    return (
        <FieldSet>
            <FieldLegend>FAQ</FieldLegend>
            {fields.map((item, index) => (
                <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                >
                    <Controller
                        name={`faq.${index}.question`}
                        control={control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={`faq-${index}-question`}>
                                    Question
                                </FieldLabel>
                                <Input
                                    id={`faq-${index}-question`}
                                    aria-invalid={fieldState.invalid}
                                    {...field}
                                />
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />
                    <Controller
                        name={`faq.${index}.answer`}
                        control={control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={`faq-${index}-answer`}>
                                    Answer
                                </FieldLabel>
                                <Textarea
                                    id={`faq-${index}-answer`}
                                    aria-invalid={fieldState.invalid}
                                    className="min-h-20"
                                    {...field}
                                />
                                {fieldState.invalid && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </Field>
                        )}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="self-start"
                        onClick={() => remove(index)}
                    >
                        <Trash2Icon />
                        Remove the question
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => append({ question: '', answer: '' })}
            >
                <PlusIcon />
                Add a question
            </Button>
        </FieldSet>
    );
}

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
import type { PageValues } from '@/features/pages/schema';

interface SourceFieldsProps {
    control: Control<PageValues>;
}

export default function SourceFields({ control }: Readonly<SourceFieldsProps>) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: 'sources',
    });

    return (
        <FieldSet>
            <FieldLegend>Sources</FieldLegend>
            {fields.map((item, index) => (
                <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border p-3"
                >
                    <Controller
                        name={`sources.${index}.title`}
                        control={control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={`source-${index}-title`}>
                                    Title
                                </FieldLabel>
                                <Input
                                    id={`source-${index}-title`}
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
                        name={`sources.${index}.url`}
                        control={control}
                        render={({ field, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                                <FieldLabel htmlFor={`source-${index}-url`}>
                                    Address
                                </FieldLabel>
                                <Input
                                    id={`source-${index}-url`}
                                    type="url"
                                    aria-invalid={fieldState.invalid}
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
                        Remove the source
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => append({ title: '', url: '' })}
            >
                <PlusIcon />
                Add a source
            </Button>
        </FieldSet>
    );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import SubmitButton from '@/components/submit-button';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { unpublishPage } from '@/features/publishing/actions';
import {
    unpublishSchema,
    type UnpublishValues,
} from '@/features/publishing/schema';

interface UnpublishDialogProps {
    projectId: string;
    pageId: string;
}

export default function UnpublishDialog({
    projectId,
    pageId,
}: Readonly<UnpublishDialogProps>) {
    const [isOpen, setIsOpen] = useState(false);

    const {
        control,
        handleSubmit,
        setError,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(unpublishSchema),
        defaultValues: blank,
    });

    const answer = useWatch({ control, name: 'answer' });

    async function onSubmit(values: UnpublishValues) {
        const result = await unpublishPage(projectId, pageId, values);

        if ('error' in result) {
            setError('root', { message: result.error });
        } else {
            reset();
            setIsOpen(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
                Unpublish
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unpublish the page</DialogTitle>
                    <DialogDescription>
                        The page stops being live, and Citequill keeps the copy,
                        so you can publish it again later.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="answer"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="unpublish-answer">
                                        When someone opens the address
                                    </FieldLabel>
                                    <Select
                                        items={answers}
                                        name={field.name}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        inputRef={field.ref}
                                    >
                                        <SelectTrigger
                                            id="unpublish-answer"
                                            aria-invalid={fieldState.invalid}
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(answers).map(
                                                ([value, label]) => (
                                                    <SelectItem
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        />
                        {answer === 'redirect' && (
                            <Controller
                                name="to"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="unpublish-to">
                                            Redirect to
                                        </FieldLabel>
                                        <Input
                                            id="unpublish-to"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="https://www.yoursite.com/pricing"
                                            {...field}
                                        />
                                        <FieldDescription>
                                            A path on the site, such as
                                            /pricing, or a full address that
                                            starts with https://.
                                        </FieldDescription>
                                        {fieldState.invalid && (
                                            <FieldError
                                                errors={[fieldState.error]}
                                            />
                                        )}
                                    </Field>
                                )}
                            />
                        )}
                        {errors.root && <FieldError errors={[errors.root]} />}
                        <SubmitButton
                            control={control}
                            pendingLabel="Unpublishing…"
                        >
                            Unpublish
                        </SubmitButton>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}

const blank: UnpublishValues = { answer: 'gone', to: '' };

const answers: Record<UnpublishValues['answer'], string> = {
    gone: '410, the page is gone',
    redirect: '301, a redirect to another address',
};

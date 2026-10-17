'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PenLineIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { startWrite } from '@/features/pages/actions';
import { writePageSchema, type WritePageValues } from '@/features/pages/schema';

interface WritePageDialogProps {
    projectId: string;
    kinds: { id: string; name: string }[];
    locales: { locale: string; isDefault: boolean }[];
}

export default function WritePageDialog({
    projectId,
    kinds,
    locales,
}: Readonly<WritePageDialogProps>) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const defaultLocale =
        locales.find((locale) => locale.isDefault)?.locale ??
        locales[0]?.locale ??
        '';

    const {
        control,
        handleSubmit,
        setError,
        reset,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(writePageSchema),
        defaultValues: {
            topic: '',
            kind_id: kinds[0]?.id ?? '',
            locale: defaultLocale,
        },
    });

    const kindItems = Object.fromEntries(
        kinds.map((kind) => [kind.id, kind.name]),
    );

    const localeItems = Object.fromEntries(
        locales.map((locale) => [locale.locale, locale.locale]),
    );

    async function onSubmit(values: WritePageValues) {
        const result = await startWrite(projectId, values);

        if (result.error) {
            setError('root', { message: result.error });
        } else {
            reset();
            setIsOpen(false);
            router.refresh();
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button />}>
                <PenLineIcon />
                Write a page
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Write a page</DialogTitle>
                    <DialogDescription>
                        Citequill plans the page, writes it from the skills and
                        checks every claim. The draft lands in Pages in a few
                        minutes.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <FieldGroup>
                        <Controller
                            name="topic"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="write-topic">
                                        Topic
                                    </FieldLabel>
                                    <Textarea
                                        id="write-topic"
                                        aria-invalid={fieldState.invalid}
                                        autoFocus
                                        placeholder="The question the page answers, in a sentence"
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
                            name="kind_id"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="write-kind">
                                        Kind
                                    </FieldLabel>
                                    <Select
                                        items={kindItems}
                                        name={field.name}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        inputRef={field.ref}
                                    >
                                        <SelectTrigger
                                            id="write-kind"
                                            aria-invalid={fieldState.invalid}
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {kinds.map((kind) => (
                                                <SelectItem
                                                    key={kind.id}
                                                    value={kind.id}
                                                >
                                                    {kind.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="locale"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="write-locale">
                                        Language
                                    </FieldLabel>
                                    <Select
                                        items={localeItems}
                                        name={field.name}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        inputRef={field.ref}
                                    >
                                        <SelectTrigger
                                            id="write-locale"
                                            aria-invalid={fieldState.invalid}
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locales.map((locale) => (
                                                <SelectItem
                                                    key={locale.locale}
                                                    value={locale.locale}
                                                >
                                                    {locale.locale}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        {errors.root && <FieldError errors={[errors.root]} />}
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Spinner />}
                            {isSubmitting ? 'Starting…' : 'Write it'}
                        </Button>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}

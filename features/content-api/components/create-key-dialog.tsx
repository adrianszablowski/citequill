'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

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
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { createSiteKey } from '@/features/content-api/actions';
import {
    siteKeySchema,
    type SiteKeyValues,
} from '@/features/content-api/schema';
import CopyButton from '@/features/projects/components/copy-button';

interface CreateKeyDialogProps {
    projectId: string;
    isFull: boolean;
}

export default function CreateKeyDialog({
    projectId,
    isFull,
}: Readonly<CreateKeyDialogProps>) {
    const [isOpen, setIsOpen] = useState(false);
    const [madeKey, setMadeKey] = useState<string | null>(null);

    const {
        control,
        handleSubmit,
        setError,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(siteKeySchema, undefined, { raw: true }),
        defaultValues: blank,
    });

    async function onSubmit(values: SiteKeyValues) {
        const result = await createSiteKey(projectId, values);

        if ('error' in result) {
            setError('root', { message: result.error });
        } else {
            reset(blank);
            setMadeKey(result.key);
        }
    }

    function onOpenChange(open: boolean) {
        setIsOpen(open);

        if (!open) {
            setMadeKey(null);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger
                render={
                    <Button
                        variant="outline"
                        className="self-start"
                        disabled={isFull}
                    />
                }
            >
                <PlusIcon />
                Create key
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a key</DialogTitle>
                    <DialogDescription>
                        Give the key the name of the place that uses it, so you
                        know which one to delete later.
                    </DialogDescription>
                </DialogHeader>
                {madeKey ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                readOnly
                                value={madeKey}
                                aria-label="The new key"
                                className="font-mono"
                            />
                            <CopyButton value={madeKey} label="Copy the key" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Copy the key now and keep it on your site&apos;s
                            server. Citequill shows it only this once.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <FieldGroup>
                            <Controller
                                name="name"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="key-name">
                                            Name
                                        </FieldLabel>
                                        <Input
                                            id="key-name"
                                            aria-invalid={fieldState.invalid}
                                            placeholder="Production"
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
                            {errors.root && (
                                <FieldError errors={[errors.root]} />
                            )}
                            <SubmitButton
                                control={control}
                                pendingLabel="Creating…"
                                className="self-start"
                            >
                                Create key
                            </SubmitButton>
                        </FieldGroup>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

const blank: SiteKeyValues = { name: '' };

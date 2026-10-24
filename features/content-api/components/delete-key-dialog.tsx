'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

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
import { FieldError } from '@/components/ui/field';
import { deleteSiteKey } from '@/features/content-api/actions';

interface DeleteKeyDialogProps {
    projectId: string;
    keyId: string;
    name: string;
}

export default function DeleteKeyDialog({
    projectId,
    keyId,
    name,
}: Readonly<DeleteKeyDialogProps>) {
    const [isOpen, setIsOpen] = useState(false);

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm();

    async function onSubmit() {
        const result = await deleteSiteKey(projectId, keyId);

        if ('error' in result) {
            setError('root', { message: result.error });
        } else {
            setIsOpen(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger
                render={<Button variant="ghost" size="sm" />}
                aria-label={`Delete ${name}`}
            >
                Delete
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete the key {name}</DialogTitle>
                    <DialogDescription>
                        The key stops working at once, and a site that still
                        sends it gets 401. Switch the site to another key first.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="flex flex-col gap-2"
                >
                    <SubmitButton
                        control={control}
                        pendingLabel="Deleting…"
                        variant="destructive"
                        className="self-start"
                    >
                        Delete the key
                    </SubmitButton>
                    {errors.root && <FieldError errors={[errors.root]} />}
                </form>
            </DialogContent>
        </Dialog>
    );
}

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
import { discardChanges } from '@/features/pages/actions';

interface DiscardChangesFormProps {
    projectId: string;
    pageId: string;
    isDisabled: boolean;
    onDiscarded: (values: LiveValues) => void;
}

export default function DiscardChangesForm({
    projectId,
    pageId,
    isDisabled,
    onDiscarded,
}: Readonly<DiscardChangesFormProps>) {
    const [isOpen, setIsOpen] = useState(false);

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm();

    async function onSubmit() {
        const result = await discardChanges(projectId, pageId);

        if ('error' in result) {
            setError('root', { message: result.error });
        } else {
            setIsOpen(false);
            onDiscarded(result.values);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger
                disabled={isDisabled}
                render={<Button variant="outline" className="self-start" />}
            >
                Discard changes
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Discard the unpublished changes</DialogTitle>
                    <DialogDescription>
                        The copy goes back to the live version. You cannot get
                        the changes back.
                    </DialogDescription>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="flex flex-col gap-2"
                >
                    <SubmitButton
                        control={control}
                        pendingLabel="Discarding…"
                        variant="destructive"
                        className="self-start"
                    >
                        Discard changes
                    </SubmitButton>
                    {errors.root && <FieldError errors={[errors.root]} />}
                </form>
            </DialogContent>
        </Dialog>
    );
}

type LiveValues = Extract<
    Awaited<ReturnType<typeof discardChanges>>,
    { values: unknown }
>['values'];

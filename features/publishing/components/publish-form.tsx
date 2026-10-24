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
import { publishPage } from '@/features/publishing/actions';

interface PublishFormProps {
    projectId: string;
    pageId: string;
    label: string;
    checkNote: string | null;
    block: string | null;
    onPublished: (notice: string | null) => void;
}

export default function PublishForm({
    projectId,
    pageId,
    label,
    checkNote,
    block,
    onPublished,
}: Readonly<PublishFormProps>) {
    const [isOpen, setIsOpen] = useState(false);

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm();

    async function onSubmit() {
        const result = await publishPage(projectId, pageId);

        if ('error' in result) {
            setError('root', { message: result.error });
        } else {
            setIsOpen(false);
            onPublished(result.notice);
        }
    }

    if (block) {
        return (
            <div className="flex flex-col gap-2">
                <Button disabled className="self-start">
                    {label}
                </Button>
                <p className="text-sm text-muted-foreground">{block}</p>
            </div>
        );
    }

    const form = (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
            <SubmitButton
                control={control}
                pendingLabel="Publishing…"
                className="self-start"
            >
                {label}
            </SubmitButton>
            {errors.root && <FieldError errors={[errors.root]} />}
        </form>
    );

    if (!checkNote) {
        return form;
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={<Button />}>{label}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Publish a page the check flagged</DialogTitle>
                    <DialogDescription>
                        The check found claims the skills do not confirm.
                        Publish once you have checked each one yourself.
                    </DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col gap-1 rounded-lg border border-destructive/30 p-3">
                    {checkNote
                        .split('\n')
                        .filter(Boolean)
                        .map((finding, index) => (
                            <li key={index}>{finding}</li>
                        ))}
                </ul>
                {form}
            </DialogContent>
        </Dialog>
    );
}

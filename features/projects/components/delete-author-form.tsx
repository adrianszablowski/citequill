'use client';

import { useForm } from 'react-hook-form';

import SubmitButton from '@/components/submit-button';
import { FieldError } from '@/components/ui/field';
import { deleteAuthor } from '@/features/projects/actions';

interface DeleteAuthorFormProps {
    projectId: string;
    authorId: string;
    onDeleted: () => void;
}

export default function DeleteAuthorForm({
    projectId,
    authorId,
    onDeleted,
}: Readonly<DeleteAuthorFormProps>) {
    const {
        control,
        handleSubmit,
        setError,
        formState: { errors },
    } = useForm();

    async function onSubmit() {
        const result = await deleteAuthor(projectId, authorId);

        if ('error' in result) {
            setError('root', { message: result.error });
        } else {
            onDeleted();
        }
    }

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-2 border-t pt-4"
        >
            <SubmitButton
                control={control}
                pendingLabel="Deleting…"
                variant="destructive"
                className="self-start"
            >
                Delete the author
            </SubmitButton>
            {errors.root && <FieldError errors={[errors.root]} />}
        </form>
    );
}

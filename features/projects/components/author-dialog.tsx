'use client';

import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import AuthorForm from '@/features/projects/components/author-form';
import DeleteAuthorForm from '@/features/projects/components/delete-author-form';
import type { AuthorValues } from '@/features/projects/schema';

interface AuthorDialogProps {
    projectId: string;
    author: { id: string; values: AuthorValues } | null;
}

export default function AuthorDialog({
    projectId,
    author,
}: Readonly<AuthorDialogProps>) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {author ? (
                <DialogTrigger
                    render={<Button variant="ghost" size="sm" />}
                    aria-label={`Edit ${author.values.name}`}
                >
                    Edit
                </DialogTrigger>
            ) : (
                <DialogTrigger
                    render={<Button variant="outline" className="self-start" />}
                >
                    <PlusIcon />
                    Add an author
                </DialogTrigger>
            )}
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {author ? 'Edit the author' : 'Add an author'}
                    </DialogTitle>
                    {author && (
                        <DialogDescription>
                            A project keeps at least one author.
                        </DialogDescription>
                    )}
                </DialogHeader>
                <AuthorForm
                    projectId={projectId}
                    author={author}
                    onSaved={() => setIsOpen(false)}
                />
                {author && (
                    <DeleteAuthorForm
                        projectId={projectId}
                        authorId={author.id}
                        onDeleted={() => setIsOpen(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

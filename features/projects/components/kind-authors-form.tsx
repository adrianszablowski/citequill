'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import SaveButton from '@/components/save-button';
import {
    FieldDescription,
    FieldError,
    FieldGroup,
} from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { updateKindAuthors } from '@/features/projects/actions';
import NotSet from '@/features/projects/components/not-set';
import {
    kindAuthorsSchema,
    type KindAuthorsValues,
    kindAuthorsValues,
} from '@/features/projects/schema';

interface KindAuthorsFormProps {
    projectId: string;
    kinds: {
        id: string;
        name: string;
        url_prefix: string | null;
        author_id: string | null;
        skills: { name: string };
    }[];
    authors: { id: string; name: string }[];
}

export default function KindAuthorsForm({
    projectId,
    kinds,
    authors,
}: Readonly<KindAuthorsFormProps>) {
    const {
        control,
        handleSubmit,
        setError,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(kindAuthorsSchema),
        defaultValues: kindAuthorsValues(kinds),
    });

    const authorItems = Object.fromEntries(
        authors.map((author) => [author.id, author.name]),
    );

    async function onSubmit(values: KindAuthorsValues) {
        const result = await updateKindAuthors(projectId, values);

        if ('values' in result) {
            reset(result.values);
        } else {
            setError('root', { message: result.error });
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kind</TableHead>
                            <TableHead>URL prefix</TableHead>
                            <TableHead>Skill</TableHead>
                            <TableHead>Author</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {kinds.map((kind, index) => (
                            <TableRow key={kind.id}>
                                <TableCell>{kind.name}</TableCell>
                                <TableCell>
                                    {kind.url_prefix || <NotSet />}
                                </TableCell>
                                <TableCell>{kind.skills.name}</TableCell>
                                <TableCell>
                                    <Controller
                                        name={`kinds.${index}.author_id`}
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <>
                                                <Select
                                                    items={authorItems}
                                                    name={field.name}
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    inputRef={field.ref}
                                                >
                                                    <SelectTrigger
                                                        aria-label={`Author of ${kind.name}`}
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }
                                                        className="w-40"
                                                    >
                                                        <SelectValue placeholder="No author" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {authors.map(
                                                            (author) => (
                                                                <SelectItem
                                                                    key={
                                                                        author.id
                                                                    }
                                                                    value={
                                                                        author.id
                                                                    }
                                                                >
                                                                    {
                                                                        author.name
                                                                    }
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                {fieldState.invalid && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
                                                )}
                                            </>
                                        )}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <FieldDescription>
                    A live page keeps the author it went live with.
                </FieldDescription>
                {errors.root && <FieldError errors={[errors.root]} />}
                <SaveButton control={control} />
            </FieldGroup>
        </form>
    );
}

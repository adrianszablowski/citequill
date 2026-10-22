'use client';

import { type Control, Controller } from 'react-hook-form';

import {
    Field,
    FieldDescription,
    FieldError,
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
import { Textarea } from '@/components/ui/textarea';
import type { PageValues } from '@/features/pages/schema';

interface PageFieldsProps {
    control: Control<PageValues>;
    authors: { id: string; name: string }[];
    isKindAuthorDefault: boolean;
    isSlugLocked: boolean;
}

export default function PageFields({
    control,
    authors,
    isKindAuthorDefault,
    isSlugLocked,
}: Readonly<PageFieldsProps>) {
    const authorItems = Object.fromEntries(
        authors.map((author) => [author.id, author.name]),
    );

    return (
        <>
            <Controller
                name="title"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="page-title">Title</FieldLabel>
                        <Input
                            id="page-title"
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
                name="slug"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="page-slug">Slug</FieldLabel>
                        <Input
                            id="page-slug"
                            aria-invalid={fieldState.invalid}
                            readOnly={isSlugLocked}
                            {...field}
                        />
                        <FieldDescription>
                            {isSlugLocked
                                ? 'The page keeps the slug it went live with.'
                                : "The last part of the page's address."}
                        </FieldDescription>
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="meta_title"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="page-meta-title">
                            Meta title
                        </FieldLabel>
                        <Input
                            id="page-meta-title"
                            aria-invalid={fieldState.invalid}
                            {...field}
                        />
                        <FieldDescription>
                            The title for search results.
                        </FieldDescription>
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="meta_description"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="page-meta-description">
                            Meta description
                        </FieldLabel>
                        <Textarea
                            id="page-meta-description"
                            aria-invalid={fieldState.invalid}
                            className="min-h-20"
                            {...field}
                        />
                        <FieldDescription>
                            The text under the title in search results.
                        </FieldDescription>
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="excerpt"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="page-excerpt">Excerpt</FieldLabel>
                        <Textarea
                            id="page-excerpt"
                            aria-invalid={fieldState.invalid}
                            className="min-h-20"
                            {...field}
                        />
                        <FieldDescription>
                            One or two sentences for lists and link previews,
                            not part of the body.
                        </FieldDescription>
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="author_id"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="page-author">Author</FieldLabel>
                        <Select
                            items={authorItems}
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            inputRef={field.ref}
                        >
                            <SelectTrigger
                                id="page-author"
                                aria-invalid={fieldState.invalid}
                                className="w-full sm:w-72"
                            >
                                <SelectValue placeholder="No author" />
                            </SelectTrigger>
                            <SelectContent>
                                {authors.map((author) => (
                                    <SelectItem
                                        key={author.id}
                                        value={author.id}
                                    >
                                        {author.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isKindAuthorDefault && (
                            <FieldDescription>
                                The kind&apos;s author, unless you pick another.
                            </FieldDescription>
                        )}
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
            <Controller
                name="tags"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="page-tags">Tags</FieldLabel>
                        <Input
                            id="page-tags"
                            aria-invalid={fieldState.invalid}
                            placeholder="protein, strength training"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value.join(', ')}
                            onChange={(event) =>
                                field.onChange(event.target.value.split(/,\s*/))
                            }
                        />
                        <FieldDescription>
                            Separate tags with commas.
                        </FieldDescription>
                        {fieldState.invalid && (
                            <FieldError errors={[fieldState.error]} />
                        )}
                    </Field>
                )}
            />
        </>
    );
}

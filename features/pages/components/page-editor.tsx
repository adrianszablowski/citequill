'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { EyeIcon, PencilIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import SaveButton from '@/components/save-button';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { updatePage } from '@/features/pages/actions';
import MarkdownToolbar from '@/features/pages/components/markdown-toolbar';
import PagePreview from '@/features/pages/components/page-preview';
import { applyFormat, type Format } from '@/features/pages/markdown-edit';
import type { Page } from '@/features/pages/queries';
import { pageSchema, type PageValues } from '@/features/pages/schema';

interface PageEditorProps {
    page: Page;
}

export default function PageEditor({ page }: Readonly<PageEditorProps>) {
    const router = useRouter();

    const {
        control,
        handleSubmit,
        setError,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(pageSchema),
        defaultValues: {
            title: page.title,
            excerpt: page.excerpt,
            body_md: page.body_md,
        },
    });

    const [isPreview, setIsPreview] = useState(true);

    const bodyRef = useRef<HTMLTextAreaElement | null>(null);

    function onFormat(format: Format) {
        const textarea = bodyRef.current;

        if (!textarea) {
            return;
        }

        const edit = applyFormat(
            textarea.value,
            { start: textarea.selectionStart, end: textarea.selectionEnd },
            format,
        );

        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(edit.start, edit.end);

        // Typed into the textarea rather than set through the form: setValue
        // puts the caret at the end of a textarea that grows with its content,
        // which scrolls the page to the Save button, and skips the browser's
        // undo stack, so Ctrl-Z would not take the formatting back.
        if (!document.execCommand('insertText', false, edit.text)) {
            textarea.setRangeText(edit.text, edit.start, edit.end);
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        textarea.setSelectionRange(edit.selection.start, edit.selection.end);
    }

    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        const format = (event.metaKey || event.ctrlKey) && shortcuts[event.key];

        if (format) {
            event.preventDefault();
            onFormat(format);
        }
    }

    async function onSubmit(values: PageValues) {
        const result = await updatePage(page.id, values);

        if (result.error) {
            setError('root', { message: result.error });
        } else {
            reset(result.values);
            router.refresh();
        }
    }

    return (
        // The card's overflow-hidden would pin the sticky toolbar to the card
        // instead of the window.
        <Card className="overflow-visible">
            <CardHeader>
                <CardTitle>{page.title}</CardTitle>
                <CardDescription>
                    {page.check_note
                        ? 'The check found claims the skills do not confirm. Fix them here or in the skills, then the page is yours to publish.'
                        : 'Every claim about the product on this page has a sentence in the skills behind it.'}
                </CardDescription>
                <CardAction>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsPreview((current) => !current)}
                    >
                        {isPreview ? <PencilIcon /> : <EyeIcon />}
                        {isPreview ? 'Edit' : 'Preview'}
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {page.check_note && !isPreview && (
                    <ul className="flex flex-col gap-1 rounded-lg border border-destructive/30 p-3 text-sm">
                        {page.check_note.split('\n').map((finding) => (
                            <li key={finding}>{finding}</li>
                        ))}
                    </ul>
                )}
                {isPreview && <PagePreview page={page} control={control} />}
                <form onSubmit={handleSubmit(onSubmit)} hidden={isPreview}>
                    <FieldGroup>
                        <Controller
                            name="title"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="page-title">
                                        Title
                                    </FieldLabel>
                                    <Input
                                        id="page-title"
                                        aria-invalid={fieldState.invalid}
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
                            name="excerpt"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="page-excerpt">
                                        Excerpt
                                    </FieldLabel>
                                    <Textarea
                                        id="page-excerpt"
                                        aria-invalid={fieldState.invalid}
                                        className="min-h-20"
                                        {...field}
                                    />
                                    <FieldDescription>
                                        One or two sentences for lists and link
                                        previews, not part of the body.
                                    </FieldDescription>
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="body_md"
                            control={control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-card py-2">
                                        <FieldLabel htmlFor="page-body">
                                            Markdown
                                        </FieldLabel>
                                        <div className="flex items-center gap-2">
                                            <MarkdownToolbar
                                                onFormat={onFormat}
                                            />
                                            <SaveButton control={control} />
                                        </div>
                                    </div>
                                    <Textarea
                                        id="page-body"
                                        aria-invalid={fieldState.invalid}
                                        className="min-h-128 font-mono text-sm"
                                        {...field}
                                        onKeyDown={onKeyDown}
                                        ref={(node) => {
                                            field.ref(node);
                                            bodyRef.current = node;
                                        }}
                                    />
                                    {fieldState.invalid && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        {errors.root && <FieldError errors={[errors.root]} />}
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}

const shortcuts: Record<string, Format | undefined> = {
    b: 'bold',
    i: 'italic',
    k: 'link',
};

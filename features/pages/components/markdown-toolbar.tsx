'use client';

import {
    BoldIcon,
    Heading2Icon,
    ItalicIcon,
    LinkIcon,
    ListIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Format } from '@/features/pages/markdown-edit';

interface MarkdownToolbarProps {
    onFormat: (format: Format) => void;
}

export default function MarkdownToolbar({
    onFormat,
}: Readonly<MarkdownToolbarProps>) {
    return (
        <div role="toolbar" aria-label="Formatting" className="flex gap-1">
            {tools.map(({ format, label, Icon }) => (
                <Button
                    key={format}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    title={label}
                    onClick={() => onFormat(format)}
                >
                    <Icon />
                </Button>
            ))}
        </div>
    );
}

const tools: { format: Format; label: string; Icon: typeof BoldIcon }[] = [
    { format: 'bold', label: 'Bold', Icon: BoldIcon },
    { format: 'italic', label: 'Italic', Icon: ItalicIcon },
    { format: 'heading', label: 'Heading', Icon: Heading2Icon },
    { format: 'list', label: 'List', Icon: ListIcon },
    { format: 'link', label: 'Link', Icon: LinkIcon },
];

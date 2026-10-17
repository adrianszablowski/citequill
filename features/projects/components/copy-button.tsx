'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

interface CopyButtonProps {
    value: string;
    label: string;
}

export default function CopyButton({
    value,
    label,
}: Readonly<CopyButtonProps>) {
    const [copiedAt, setCopiedAt] = useState<number | null>(null);
    const isCopied = copiedAt !== null;

    useEffect(() => {
        if (copiedAt === null) {
            return;
        }

        const timer = setTimeout(() => setCopiedAt(null), 2_000);

        return () => clearTimeout(timer);
    }, [copiedAt]);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopiedAt(Date.now());
        } catch {
            setCopiedAt(null);
        }
    }

    return (
        <Button
            type="button"
            variant="outline"
            aria-label={label}
            onClick={copy}
        >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
            {isCopied ? 'Copied' : 'Copy'}
        </Button>
    );
}

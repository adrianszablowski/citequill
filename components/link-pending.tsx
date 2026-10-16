'use client';

import { useLinkStatus } from 'next/link';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export default function LinkPending() {
    const { pending } = useLinkStatus();

    return (
        <Spinner
            aria-hidden
            className={cn(
                'ml-auto transition-opacity',
                pending ? 'opacity-100' : 'opacity-0',
            )}
        />
    );
}

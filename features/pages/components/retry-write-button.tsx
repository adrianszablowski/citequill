'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function RetryWriteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending && <Spinner />}
            {pending ? 'Starting…' : 'Try again'}
        </Button>
    );
}

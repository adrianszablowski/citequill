'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function CrawlAgainButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending && <Spinner />}
            {pending ? 'Starting…' : 'Run the crawl again'}
        </Button>
    );
}

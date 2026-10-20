'use client';

import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface LoadErrorProps {
    title: string;
    retry: () => void;
}

export default function LoadError({ title, retry }: Readonly<LoadErrorProps>) {
    const [isPending, startTransition] = useTransition();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <Button
                    disabled={isPending}
                    onClick={() => startTransition(retry)}
                    className="w-full sm:w-auto"
                >
                    {isPending && <Spinner />}
                    {isPending ? 'Trying again…' : 'Try again'}
                </Button>
            </CardContent>
        </Card>
    );
}

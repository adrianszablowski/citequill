'use client';

import type { ErrorInfo } from 'next/error';

import LoadError from '@/components/load-error';

export default function RootError({ retry }: Readonly<ErrorInfo>) {
    return (
        <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
            <div className="w-full max-w-sm">
                <LoadError title="This page did not load" retry={retry} />
            </div>
        </main>
    );
}

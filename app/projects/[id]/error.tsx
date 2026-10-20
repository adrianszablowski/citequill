'use client';

import type { ErrorInfo } from 'next/error';

import LoadError from '@/components/load-error';

export default function ProjectError({ retry }: Readonly<ErrorInfo>) {
    return <LoadError title="This section did not load" retry={retry} />;
}

import { ArrowLeftIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface BackLinkProps<T extends string> {
    href: Route<T>;
    children: ReactNode;
}

export default function BackLink<T extends string>({
    href,
    children,
}: Readonly<BackLinkProps<T>>) {
    return (
        <Button
            nativeButton={false}
            render={<Link href={href} />}
            variant="ghost"
            className="self-start"
        >
            <ArrowLeftIcon />
            {children}
        </Button>
    );
}

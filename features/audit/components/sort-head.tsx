import { ArrowDownIcon, ChevronsUpDownIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';

import { TableHead } from '@/components/ui/table';

interface SortHeadProps<T extends string> {
    href: Route<T>;
    label: string;
    isActive: boolean;
    className?: string;
}

export default function SortHead<T extends string>({
    href,
    label,
    isActive,
    className,
}: Readonly<SortHeadProps<T>>) {
    const Icon = isActive ? ArrowDownIcon : ChevronsUpDownIcon;

    return (
        <TableHead className={className}>
            <Link
                href={href}
                className="inline-flex items-center gap-1 hover:text-foreground"
            >
                {label}
                <Icon
                    className={
                        isActive ? 'size-3.5' : 'size-3.5 text-muted-foreground'
                    }
                />
            </Link>
        </TableHead>
    );
}

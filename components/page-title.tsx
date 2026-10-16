'use client';

import { usePathname } from 'next/navigation';

import { pageTitle } from '@/lib/sections';

export default function PageTitle() {
    const pathname = usePathname();

    return <h1 className="text-base font-medium">{pageTitle(pathname)}</h1>;
}

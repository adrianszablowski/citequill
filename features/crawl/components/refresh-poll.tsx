'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RefreshPoll() {
    const router = useRouter();

    useEffect(() => {
        const timer = setInterval(() => router.refresh(), everyMs);

        return () => clearInterval(timer);
    }, [router]);

    return null;
}

const everyMs = 3_000;

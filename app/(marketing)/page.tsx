import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function LandingPage() {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
            <h1 className="text-3xl font-semibold">Citequill</h1>
            <p className="max-w-md text-muted-foreground">
                A hosted SEO and GEO autopilot.
            </p>
            <Button
                nativeButton={false}
                render={<Link href="/login" />}
                size="lg"
            >
                Sign in
            </Button>
        </main>
    );
}

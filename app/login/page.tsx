import { Suspense } from 'react';

import { signInWithGoogle } from '@/features/auth/actions';
import GoogleSignInButton from '@/features/auth/components/google-sign-in-button';
import LoginError from '@/features/auth/components/login-error';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
    return (
        <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">
                        Sign in to Citequill
                    </CardTitle>
                    <CardDescription>
                        During the preview only invited Google accounts get in.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <form action={signInWithGoogle}>
                        <GoogleSignInButton />
                    </form>
                    <Suspense>
                        <LoginError searchParams={searchParams} />
                    </Suspense>
                </CardContent>
            </Card>
        </main>
    );
}

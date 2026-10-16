interface LoginErrorProps {
    searchParams: Promise<{ error?: string | string[] }>;
}

export default async function LoginError({
    searchParams,
}: Readonly<LoginErrorProps>) {
    const { error } = await searchParams;

    const message =
        typeof error === 'string' ? errorMessages[error] : undefined;

    if (!message) {
        return null;
    }

    return (
        <p role="alert" className="text-center text-sm text-destructive">
            {message}
        </p>
    );
}

const errorMessages: Record<string, string> = {
    'not-allowed': 'This Google account is not on the invited list.',
    google: 'Signing in with Google did not finish. Try again.',
};

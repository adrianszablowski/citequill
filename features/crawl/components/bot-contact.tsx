interface BotContactProps {
    email?: string;
}

export default function BotContact({ email }: Readonly<BotContactProps>) {
    if (!email) {
        return null;
    }

    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold">Contact</h2>
            <p>
                Write to{' '}
                <a
                    href={`mailto:${email}`}
                    className="underline underline-offset-4"
                >
                    {email}
                </a>{' '}
                about CitequillBot.
            </p>
        </section>
    );
}

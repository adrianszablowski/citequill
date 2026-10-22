import { notFound } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/queries';
import BotSecret from '@/features/projects/components/bot-secret';
import { getBotSecret } from '@/features/projects/queries';

interface SettingsAuditProps {
    params: Promise<{ id: string }>;
}

export default async function SettingsAudit({
    params,
}: Readonly<SettingsAuditProps>) {
    const { id } = await params;

    await getCurrentUser();

    const botSecret = await getBotSecret(id);

    if (botSecret === null) {
        notFound();
    }

    return <BotSecret projectId={id} secret={botSecret} />;
}

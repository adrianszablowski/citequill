import { regenerateBotSecret } from '@/features/projects/actions';
import RegenerateSecretButton from '@/features/projects/components/regenerate-secret-button';

interface RegenerateSecretFormProps {
    projectId: string;
}

export default function RegenerateSecretForm({
    projectId,
}: Readonly<RegenerateSecretFormProps>) {
    async function regenerate() {
        'use server';

        await regenerateBotSecret(projectId);
    }

    return (
        <form action={regenerate}>
            <RegenerateSecretButton />
        </form>
    );
}

import { stopAudit } from '@/features/audit/actions';
import StopAuditButton from '@/features/audit/components/stop-audit-button';

interface StopAuditFormProps {
    projectId: string;
}

export default function StopAuditForm({
    projectId,
}: Readonly<StopAuditFormProps>) {
    async function stop() {
        'use server';

        await stopAudit(projectId);
    }

    return (
        <form action={stop}>
            <StopAuditButton />
        </form>
    );
}

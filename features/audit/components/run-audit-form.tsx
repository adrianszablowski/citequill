import { startAudit } from '@/features/audit/actions';
import RunAuditButton from '@/features/audit/components/run-audit-button';

interface RunAuditFormProps {
    projectId: string;
    label: string;
}

export default function RunAuditForm({
    projectId,
    label,
}: Readonly<RunAuditFormProps>) {
    async function runAudit() {
        'use server';

        await startAudit(projectId);
    }

    return (
        <form action={runAudit}>
            <RunAuditButton label={label} />
        </form>
    );
}

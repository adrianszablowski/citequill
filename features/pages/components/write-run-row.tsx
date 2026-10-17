import { Spinner } from '@/components/ui/spinner';
import RetryWriteForm from '@/features/pages/components/retry-write-form';
import type { WriteRun } from '@/features/pages/queries';

interface WriteRunRowProps {
    projectId: string;
    run: WriteRun;
}

export default function WriteRunRow({
    projectId,
    run,
}: Readonly<WriteRunRowProps>) {
    const label = `${run.page_kinds?.name ?? 'Page'} in ${run.locale ?? '?'}: ${run.topic}`;

    if (run.outcome === 'writing') {
        return (
            <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                <Spinner />
                <span className="flex-1">Writing {label}</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-3 text-sm sm:flex-row sm:items-center">
            <div className="flex flex-1 flex-col gap-1">
                <span>{label} did not finish.</span>
                <span className="text-muted-foreground">
                    {run.error ?? 'It made no progress for 15 minutes.'}
                </span>
            </div>
            <RetryWriteForm projectId={projectId} runId={run.id} />
        </div>
    );
}

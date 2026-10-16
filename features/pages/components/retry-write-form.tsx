import { retryWrite } from '@/features/pages/actions';
import RetryWriteButton from '@/features/pages/components/retry-write-button';

interface RetryWriteFormProps {
    projectId: string;
    runId: string;
}

export default function RetryWriteForm({
    projectId,
    runId,
}: Readonly<RetryWriteFormProps>) {
    async function tryAgain() {
        'use server';

        await retryWrite(projectId, runId);
    }

    return (
        <form action={tryAgain}>
            <RetryWriteButton />
        </form>
    );
}

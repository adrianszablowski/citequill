import { markFinding, unmarkFinding } from '@/features/audit/actions';
import MarkButton from '@/features/audit/components/mark-button';
import type { Mark } from '@/features/audit/score';

interface MarkFormProps {
    projectId: string;
    mark: Mark;
    isMarked: boolean;
    label: string;
}

export default function MarkForm({
    projectId,
    mark,
    isMarked,
    label,
}: Readonly<MarkFormProps>) {
    async function act() {
        'use server';

        await (isMarked ? unmarkFinding : markFinding)(projectId, mark);
    }

    return (
        <form action={act}>
            <MarkButton label={label} isMarked={isMarked} />
        </form>
    );
}

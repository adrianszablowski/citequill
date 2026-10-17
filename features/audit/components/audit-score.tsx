import ScoreBand from '@/features/audit/components/score-band';
import { formatCount } from '@/lib/utils';

interface AuditScoreProps {
    score: number;
    checksScored: number;
    checksTotal: number;
}

export default function AuditScore({
    score,
    checksScored,
    checksTotal,
}: Readonly<AuditScoreProps>) {
    return (
        <div className="flex flex-col gap-1">
            <ScoreBand score={score} className="text-4xl" />
            <p className="text-muted-foreground">
                Scored from {formatCount(checksScored)} of{' '}
                {formatCount(checksTotal)} checks
            </p>
        </div>
    );
}

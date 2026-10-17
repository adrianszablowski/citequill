import { band, type Band } from '@/features/audit/score';
import { cn } from '@/lib/utils';

interface ScoreBandProps {
    score: number;
    className?: string;
}

export default function ScoreBand({
    score,
    className,
}: Readonly<ScoreBandProps>) {
    const { label, color } = bands[band(score)];

    return (
        <span
            className={cn('inline-flex items-baseline gap-3', color, className)}
        >
            <span className="font-semibold tabular-nums">{score}</span>
            <span className="text-sm font-medium">{label}</span>
        </span>
    );
}

const bands: Record<Band, { label: string; color: string }> = {
    good: { label: 'Good', color: 'text-green-700 dark:text-green-400' },
    'needs-work': {
        label: 'Needs work',
        color: 'text-amber-700 dark:text-amber-400',
    },
    poor: { label: 'Poor', color: 'text-red-700 dark:text-red-400' },
};

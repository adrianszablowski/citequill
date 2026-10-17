import { Badge } from '@/components/ui/badge';
import type { Severity } from '@/features/audit/catalogue';
import { severityNames } from '@/features/audit/check-texts';

interface SeverityBadgeProps {
    severity: Severity;
}

export default function SeverityBadge({
    severity,
}: Readonly<SeverityBadgeProps>) {
    return (
        <Badge variant={variants[severity]}>{severityNames[severity]}</Badge>
    );
}

const variants = {
    '3': 'destructive',
    '2': 'default',
    '1': 'secondary',
    hint: 'outline',
    question: 'outline',
} as const;

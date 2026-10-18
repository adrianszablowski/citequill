import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import ScoreBand from '@/features/audit/components/score-band';
import { formatDuration } from '@/features/audit/format';
import type { Audit } from '@/features/audit/queries';
import { formatCount, formatDate, formatUsd } from '@/lib/utils';

interface AuditHistoryProps {
    audits: Audit[];
    isOperator: boolean;
}

export default function AuditHistory({
    audits,
    isOperator,
}: Readonly<AuditHistoryProps>) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
                {audits.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Every audit lands here, with its date, state and score.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>State</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead className="text-right">
                                    Pages read
                                </TableHead>
                                <TableHead className="text-right">
                                    Time taken
                                </TableHead>
                                {isOperator && (
                                    <TableHead className="text-right">
                                        Cost
                                    </TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {audits.map(({ run, audit, status }) => (
                                <TableRow key={run.id}>
                                    <TableCell>
                                        {formatDate(run.started_at)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={states[status].variant}>
                                            {states[status].label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {audit && audit.score !== null && (
                                            <ScoreBand score={audit.score} />
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatCount(audit?.pages_read ?? 0)}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                        {audit && audit.duration_s !== null
                                            ? formatDuration(audit.duration_s)
                                            : ''}
                                    </TableCell>
                                    {isOperator && (
                                        <TableCell className="text-right">
                                            {formatUsd(run.cost_usd)}
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

const states = {
    running: { label: 'Running', variant: 'secondary' },
    finished: { label: 'Finished', variant: 'default' },
    failed: { label: 'Failed', variant: 'destructive' },
    stalled: { label: 'Stalled', variant: 'outline' },
} as const;

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import AuditScore from '@/features/audit/components/audit-score';
import RunAuditForm from '@/features/audit/components/run-audit-form';
import StopAuditForm from '@/features/audit/components/stop-audit-form';
import {
    type Changes,
    changesLine,
    formatDuration,
    stalledMessage,
} from '@/features/audit/format';
import type { Audit } from '@/features/audit/queries';
import { queueCap } from '@/features/audit/queue';
import RefreshPoll from '@/features/crawl/components/refresh-poll';
import { formatCount, formatDate, pagesRead } from '@/lib/utils';

interface LatestAuditProps {
    projectId: string;
    domain: string;
    latest: Audit | null;
    changes: Changes | null;
}

export default function LatestAudit({
    projectId,
    domain,
    latest,
    changes,
}: Readonly<LatestAuditProps>) {
    if (!latest) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Audit {domain}</CardTitle>
                </CardHeader>
                <CardContent>
                    <RunAuditForm projectId={projectId} label="Run the audit" />
                </CardContent>
            </Card>
        );
    }

    if (latest.status === 'running') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Auditing {domain}</CardTitle>
                    <CardDescription>{latest.started}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Spinner />
                        <span>{pagesRead(latest.audit?.pages_read ?? 0)}</span>
                    </div>
                    <StopAuditForm projectId={projectId} />
                    <RefreshPoll />
                </CardContent>
            </Card>
        );
    }

    const { audit } = latest;

    if (latest.status === 'finished' && audit) {
        const facts = [
            { label: 'Pages read', value: formatCount(audit.pages_read) },
            { label: 'Indexable', value: formatCount(audit.pages_indexable) },
            {
                label: 'Time taken',
                value: formatDuration(audit.duration_s ?? 0),
            },
        ];

        return (
            <Card>
                <CardHeader>
                    <CardTitle>
                        Audit of {formatDate(audit.created_at)}
                    </CardTitle>
                    {audit.is_partial && (
                        <CardDescription>
                            The site has more than {formatCount(queueCap)}{' '}
                            pages, so this audit read the first{' '}
                            {formatCount(queueCap)}.
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {audit.score !== null && (
                        <div className="flex flex-col gap-1">
                            <AuditScore
                                score={audit.score}
                                checksScored={audit.checks_scored}
                                checksTotal={audit.checks_total}
                            />
                            {changes && (
                                <p className="text-muted-foreground">
                                    {changesLine(changes)}
                                </p>
                            )}
                        </div>
                    )}
                    <dl className="grid grid-cols-3 gap-4">
                        {facts.map((fact) => (
                            <div
                                key={fact.label}
                                className="flex flex-col gap-1"
                            >
                                <dt className="text-muted-foreground">
                                    {fact.label}
                                </dt>
                                <dd className="text-lg font-medium">
                                    {fact.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <RunAuditForm
                        projectId={projectId}
                        label="Run the audit again"
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>The audit stopped</CardTitle>
                <CardDescription>
                    {latest.status === 'stalled'
                        ? stalledMessage
                        : (latest.run.error ??
                          'The audit stopped without a message.')}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {audit && audit.score !== null && (
                    <div className="flex flex-col gap-1">
                        <AuditScore
                            score={audit.score}
                            checksScored={audit.checks_scored}
                            checksTotal={audit.checks_total}
                        />
                        <p className="text-muted-foreground">
                            This score is partial. It counts only the pages read
                            before the audit stopped.
                        </p>
                    </div>
                )}
                <RunAuditForm
                    projectId={projectId}
                    label="Run the audit again"
                />
            </CardContent>
        </Card>
    );
}

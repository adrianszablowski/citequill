import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AuditFindings from '@/features/audit/components/audit-findings';
import AuditFindingsSkeleton from '@/features/audit/components/audit-findings-skeleton';
import AuditHistory from '@/features/audit/components/audit-history';
import LatestAudit from '@/features/audit/components/latest-audit';
import { getAudits, getChanges } from '@/features/audit/queries';
import { comparedAudits, shownAudit } from '@/features/audit/shown';
import { getCurrentUser, isOperator } from '@/features/auth/queries';
import { getProject } from '@/features/projects/queries';

interface AuditSectionProps {
    params: Promise<{ id: string }>;
    searchParams: PageProps<'/projects/[id]/audit'>['searchParams'];
}

export default async function AuditSection({
    params,
    searchParams,
}: Readonly<AuditSectionProps>) {
    const { id } = await params;

    await getCurrentUser();

    const [project, audits, operator] = await Promise.all([
        getProject(id),
        getAudits(id),
        isOperator(),
    ]);

    if (!project) {
        notFound();
    }

    const compared = comparedAudits(audits);

    const changes = compared && {
        ...compared,
        ...(await getChanges(compared.latestId, compared.previousId)),
    };

    const shown = shownAudit(audits);

    return (
        <div className="flex flex-col gap-6">
            <LatestAudit
                projectId={id}
                domain={project.domain}
                latest={audits[0] ?? null}
                changes={changes}
            />
            {shown ? (
                <Suspense fallback={<AuditFindingsSkeleton />}>
                    <AuditFindings
                        projectId={id}
                        shown={shown}
                        searchParams={searchParams}
                    />
                </Suspense>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Findings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Once an audit ends, Citequill lists its findings
                            here, by check and by page.
                        </p>
                    </CardContent>
                </Card>
            )}
            {audits.length > 0 && (
                <AuditHistory audits={audits} isOperator={operator} />
            )}
        </div>
    );
}

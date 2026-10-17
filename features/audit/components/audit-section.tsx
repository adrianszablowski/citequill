import { notFound } from 'next/navigation';

import AuditHistory from '@/features/audit/components/audit-history';
import LatestAudit from '@/features/audit/components/latest-audit';
import { getAudits } from '@/features/audit/queries';
import { getCurrentUser } from '@/features/auth/queries';
import { getProject } from '@/features/projects/queries';

interface AuditSectionProps {
    params: Promise<{ id: string }>;
}

export default async function AuditSection({
    params,
}: Readonly<AuditSectionProps>) {
    const { id } = await params;

    await getCurrentUser();

    const [project, audits] = await Promise.all([
        getProject(id),
        getAudits(id),
    ]);

    if (!project) {
        notFound();
    }

    return (
        <div className="flex flex-col gap-6">
            <LatestAudit
                projectId={id}
                domain={project.domain}
                latest={audits[0] ?? null}
            />
            {/* TODO: the findings by finding and by page, the images card and
            the marks go here; backlog 2026-10-17, the rest of audit slice 1. */}
            {audits.length > 0 && <AuditHistory audits={audits} />}
        </div>
    );
}

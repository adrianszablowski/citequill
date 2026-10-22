import { Suspense } from 'react';

import SettingsAudit from '@/features/projects/components/settings-audit';
import SettingsAuditSkeleton from '@/features/projects/components/settings-audit-skeleton';

export default function SettingsAuditTab({
    params,
}: PageProps<'/projects/[id]/settings/audit'>) {
    return (
        <section className="flex flex-col gap-6">
            <p className="text-muted-foreground">
                The bot secret lets the audit through your firewall.
            </p>
            <Suspense fallback={<SettingsAuditSkeleton />}>
                <SettingsAudit params={params} />
            </Suspense>
        </section>
    );
}

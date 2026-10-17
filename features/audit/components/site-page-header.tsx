import { Badge } from '@/components/ui/badge';
import type { getSitePage } from '@/features/audit/queries';

interface SitePageHeaderProps {
    sitePage: NonNullable<Awaited<ReturnType<typeof getSitePage>>>;
}

export default function SitePageHeader({
    sitePage,
}: Readonly<SitePageHeaderProps>) {
    const facts = [
        { label: 'Status', value: sitePage.status_code ?? 'No answer' },
        {
            label: 'Canonical',
            value:
                sitePage.canonical_url === sitePage.url
                    ? 'Itself'
                    : (sitePage.canonical_url ?? 'None'),
        },
        { label: 'Title', value: sitePage.title ?? 'None' },
    ];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col items-start gap-1">
                <h2 className="font-medium break-all">{sitePage.url}</h2>
                {sitePage.page_id && (
                    <Badge variant="secondary">Written by Citequill</Badge>
                )}
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
                {facts.map((fact) => (
                    <div
                        key={fact.label}
                        className="flex min-w-0 flex-col gap-1"
                    >
                        <dt className="text-muted-foreground">{fact.label}</dt>
                        <dd className="break-all">{fact.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

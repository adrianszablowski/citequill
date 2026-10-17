import type { FindingItem } from '@/features/audit/queries';

interface FindingElementProps {
    finding: FindingItem;
}

export default function FindingElement({
    finding,
}: Readonly<FindingElementProps>) {
    return (
        <div className="flex min-w-0 flex-col gap-1 text-sm">
            {finding.subject && <p className="break-all">{finding.subject}</p>}
            {finding.selector && (
                <code className="break-all text-muted-foreground">
                    {finding.selector}
                </code>
            )}
            {finding.snippet && (
                <code className="rounded bg-muted px-2 py-1 text-xs break-all">
                    {finding.snippet}
                </code>
            )}
        </div>
    );
}

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import FindingElement from '@/features/audit/components/finding-element';
import FindingMarks from '@/features/audit/components/finding-marks';
import type { FindingItem } from '@/features/audit/queries';
import type { Mark } from '@/features/audit/score';

interface CheckFindingsProps {
    findings: FindingItem[];
    projectId: string;
    marks: Mark[];
    canMark: boolean;
}

export default function CheckFindings({
    findings,
    ...marking
}: Readonly<CheckFindingsProps>) {
    if (findings.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                This audit has no page with this finding.
            </p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead>Found</TableHead>
                    <TableHead />
                </TableRow>
            </TableHeader>
            <TableBody>
                {findings.map((finding) => (
                    <TableRow key={finding.id}>
                        <TableCell className="max-w-80 align-top font-medium break-all whitespace-normal">
                            {finding.site_pages?.url ?? 'The site'}
                        </TableCell>
                        <TableCell className="max-w-96 align-top whitespace-normal">
                            <FindingElement finding={finding} />
                        </TableCell>
                        <TableCell className="align-top">
                            <FindingMarks finding={finding} {...marking} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

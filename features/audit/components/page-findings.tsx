import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { CheckId, Severity } from '@/features/audit/catalogue';
import CheckExplanation from '@/features/audit/components/check-explanation';
import FindingElement from '@/features/audit/components/finding-element';
import FindingMarks from '@/features/audit/components/finding-marks';
import SeverityBadge from '@/features/audit/components/severity-badge';
import { checkText } from '@/features/audit/check-texts';
import type { FindingItem } from '@/features/audit/queries';
import type { Mark } from '@/features/audit/score';

interface PageFindingsProps {
    findings: FindingItem[];
    projectId: string;
    marks: Mark[];
    canMark: boolean;
}

export default function PageFindings({
    findings,
    ...marking
}: Readonly<PageFindingsProps>) {
    if (findings.length === 0) {
        return (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                This audit has no finding on this page.
            </p>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Finding</TableHead>
                    <TableHead>Found</TableHead>
                    <TableHead />
                </TableRow>
            </TableHeader>
            <TableBody>
                {findings.map((finding) => {
                    const check = finding.check as CheckId;

                    return (
                        <TableRow key={finding.id}>
                            <TableCell className="max-w-md align-top whitespace-normal">
                                <div className="flex flex-col items-start gap-2">
                                    <SeverityBadge
                                        severity={finding.severity as Severity}
                                    />
                                    <p className="font-medium">
                                        {checkText(check)?.name ?? check}
                                    </p>
                                    <CheckExplanation check={check} />
                                </div>
                            </TableCell>
                            <TableCell className="max-w-80 align-top whitespace-normal">
                                <FindingElement finding={finding} />
                            </TableCell>
                            <TableCell className="align-top">
                                <FindingMarks finding={finding} {...marking} />
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

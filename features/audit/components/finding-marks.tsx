import { Badge } from '@/components/ui/badge';
import MarkForm from '@/features/audit/components/mark-form';
import type { FindingItem } from '@/features/audit/queries';
import { hasMark, type Mark, offersSelectorMark } from '@/features/audit/score';

interface FindingMarksProps {
    projectId: string;
    finding: FindingItem;
    marks: Mark[];
    canMark: boolean;
}

export default function FindingMarks({
    projectId,
    finding,
    marks,
    canMark,
}: Readonly<FindingMarksProps>) {
    const url = finding.site_pages?.url ?? finding.subject;
    const where = finding.site_pages ? 'on this page' : 'for this URL';

    const onUrl = url && {
        check: finding.check,
        url,
        selector: null,
    };

    const onSelector = finding.selector && {
        check: finding.check,
        url: null,
        selector: finding.selector,
    };

    return (
        <div className="flex flex-col items-start gap-2">
            {finding.is_intended && <Badge variant="outline">Intended</Badge>}
            {canMark && onUrl && (
                <MarkForm
                    projectId={projectId}
                    mark={onUrl}
                    isMarked={hasMark(marks, onUrl)}
                    label={
                        hasMark(marks, onUrl)
                            ? `Unmark ${where}`
                            : `Mark as intended ${where}`
                    }
                />
            )}
            {canMark && onSelector && offersSelectorMark(marks, onSelector) && (
                <MarkForm
                    projectId={projectId}
                    mark={onSelector}
                    isMarked={hasMark(marks, onSelector)}
                    label={
                        hasMark(marks, onSelector)
                            ? 'Unmark this element on every page'
                            : 'Mark this element as intended on every page'
                    }
                />
            )}
        </div>
    );
}

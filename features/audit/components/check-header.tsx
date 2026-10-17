import { type CheckId, checkOf } from '@/features/audit/catalogue';
import CheckExplanation from '@/features/audit/components/check-explanation';
import MarkForm from '@/features/audit/components/mark-form';
import SeverityBadge from '@/features/audit/components/severity-badge';
import { areaNames, checkText } from '@/features/audit/check-texts';
import { hasMark, type Mark } from '@/features/audit/score';

interface CheckHeaderProps {
    check: CheckId;
    projectId: string;
    marks: Mark[];
    canMark: boolean;
}

export default function CheckHeader({
    check,
    projectId,
    marks,
    canMark,
}: Readonly<CheckHeaderProps>) {
    const { severity, area } = checkOf(check);
    const onSite = { check, url: null, selector: null };
    const isMarked = hasMark(marks, onSite);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 className="font-medium">
                    {checkText(check)?.name ?? check}
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <SeverityBadge severity={severity} />
                    {areaNames[area]}
                </div>
            </div>
            <CheckExplanation check={check} />
            {canMark && (
                <MarkForm
                    projectId={projectId}
                    mark={onSite}
                    isMarked={isMarked}
                    label={
                        isMarked
                            ? 'Unmark for the whole site'
                            : 'Mark as intended for the whole site'
                    }
                />
            )}
        </div>
    );
}

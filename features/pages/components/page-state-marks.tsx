import { Badge } from '@/components/ui/badge';
import type { PageListItem, PageVersion } from '@/features/pages/queries';
import { versionsDiverge, versionState } from '@/features/publishing/state';

interface PageStateMarksProps {
    page: PageListItem;
    group: PageVersion[];
}

export default function PageStateMarks({
    page,
    group,
}: Readonly<PageStateMarksProps>) {
    const state = versionState(page);

    return (
        <div className="flex flex-wrap gap-1">
            {state === 'draft' && (
                <Badge variant={page.check_note ? 'destructive' : 'secondary'}>
                    {page.check_note ? 'Draft, check failed' : 'Draft'}
                </Badge>
            )}
            {state === 'unpublished' && (
                <Badge variant="outline">Unpublished</Badge>
            )}
            {(state === 'live' || state === 'changed') && <Badge>Live</Badge>}
            {state === 'changed' && (
                <Badge variant="outline">Unpublished changes</Badge>
            )}
            {versionsDiverge(group) && (
                <Badge variant="outline">Language versions differ</Badge>
            )}
        </div>
    );
}

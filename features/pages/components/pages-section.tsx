import { getCurrentUser } from '@/features/auth/queries';
import RefreshPoll from '@/features/crawl/components/refresh-poll';
import PageTable from '@/features/pages/components/page-table';
import WritePageDialog from '@/features/pages/components/write-page-dialog';
import WriteRunRow from '@/features/pages/components/write-run-row';
import { getPageList, getWriteRuns } from '@/features/pages/queries';
import { getPageKinds, getProjectLocales } from '@/features/projects/queries';

interface PagesSectionProps {
    params: Promise<{ id: string }>;
}

export default async function PagesSection({
    params,
}: Readonly<PagesSectionProps>) {
    const { id } = await params;

    await getCurrentUser();

    const [pages, runs, kinds, locales] = await Promise.all([
        getPageList(id),
        getWriteRuns(id),
        getPageKinds(id),
        getProjectLocales(id),
    ]);

    const isWriting = runs.some((run) => run.outcome === 'writing');

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                <p className="text-muted-foreground">
                    Every page of this project, draft or published, with its
                    language and kind.
                </p>
                <WritePageDialog
                    projectId={id}
                    kinds={kinds.map((kind) => ({
                        id: kind.id,
                        name: kind.name,
                    }))}
                    locales={locales.map((locale) => ({
                        locale: locale.locale,
                        isDefault: locale.is_default,
                    }))}
                />
            </div>
            {runs.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {runs.map((run) => (
                        <li key={run.id}>
                            <WriteRunRow projectId={id} run={run} />
                        </li>
                    ))}
                </ul>
            )}
            <PageTable projectId={id} pages={pages} />
            {isWriting && <RefreshPoll />}
        </div>
    );
}

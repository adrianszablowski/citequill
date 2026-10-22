import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/features/auth/queries';
import RefreshPoll from '@/features/crawl/components/refresh-poll';
import PageFilters from '@/features/pages/components/page-filters';
import PagePagination from '@/features/pages/components/page-pagination';
import PageTable from '@/features/pages/components/page-table';
import WritePageDialog from '@/features/pages/components/write-page-dialog';
import WriteRunRow from '@/features/pages/components/write-run-row';
import { pagePath } from '@/features/pages/draft';
import { pageListHref } from '@/features/pages/list-query';
import {
    getPageList,
    getPageVersions,
    getWriteRuns,
} from '@/features/pages/queries';
import { pageListQuery } from '@/features/pages/schema';
import { getPageKinds, getProjectLocales } from '@/features/projects/queries';

interface PagesSectionProps {
    params: Promise<{ id: string }>;
    searchParams: PageProps<'/projects/[id]/pages'>['searchParams'];
}

export default async function PagesSection({
    params,
    searchParams,
}: Readonly<PagesSectionProps>) {
    const [{ id }, query] = await Promise.all([
        params,
        searchParams.then((raw) => pageListQuery.parse(raw)),
    ]);

    await getCurrentUser();

    const [{ rows: pages, total }, runs, kinds, locales] = await Promise.all([
        getPageList(id, query),
        getWriteRuns(id),
        getPageKinds(id),
        getProjectLocales(id),
    ]);

    const lastPage =
        total === null ? 1 : Math.max(1, Math.ceil(total / query.size));

    if (total === null || query.page > lastPage) {
        redirect(pageListHref(id, { ...query, page: lastPage }));
    }

    const kind = kinds.find((candidate) => candidate.id === query.kind);

    if (!kind && kinds.length > 0) {
        redirect(pageListHref(id, { ...query, kind: kinds[0].id }));
    }

    const versions = await getPageVersions(
        id,
        pages.map((page) => page.translation_group_id),
    );

    const mainLocale =
        locales.find((locale) => locale.is_default) ?? locales[0];

    const isWriting = runs.some((run) => run.outcome === 'writing');

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                {kind ? (
                    <div className="flex flex-col gap-1">
                        <h2 className="font-medium">{kind.name}</h2>
                        <p className="text-sm text-muted-foreground">
                            {mainLocale
                                ? pagePath(
                                      mainLocale.base_url,
                                      kind.url_prefix,
                                      '',
                                  )
                                : kind.url_prefix}
                        </p>
                    </div>
                ) : (
                    <p className="text-muted-foreground">
                        No page kinds yet. Run the crawl again in Settings and
                        the kinds appear here.
                    </p>
                )}
                <WritePageDialog
                    projectId={id}
                    kinds={kinds.map((item) => ({
                        id: item.id,
                        name: item.name,
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
            <PageFilters
                projectId={id}
                query={query}
                locales={locales.map((locale) => locale.locale)}
            />
            <PageTable
                projectId={id}
                pages={pages}
                versions={versions}
                query={query}
            />
            <PagePagination
                query={query}
                total={total}
                hrefOf={(change) => pageListHref(id, { ...query, ...change })}
            />
            {isWriting && <RefreshPoll />}
        </div>
    );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';

import BackLink from '@/components/back-link';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import CheckFindings from '@/features/audit/components/check-findings';
import CheckHeader from '@/features/audit/components/check-header';
import CheckTable from '@/features/audit/components/check-table';
import FindingFilters from '@/features/audit/components/finding-filters';
import PageFindings from '@/features/audit/components/page-findings';
import SitePageHeader from '@/features/audit/components/site-page-header';
import SitePageTable from '@/features/audit/components/site-page-table';
import { findingListHref } from '@/features/audit/list-query';
import {
    getFindingList,
    getMarks,
    getSitePage,
} from '@/features/audit/queries';
import { findingListQuery } from '@/features/audit/schema';
import type { shownAudit } from '@/features/audit/shown';
import { getCurrentUser } from '@/features/auth/queries';
import PagePagination from '@/features/pages/components/page-pagination';
import { getProjectLocales } from '@/features/projects/queries';
import { formatDate } from '@/lib/utils';

interface AuditFindingsProps {
    projectId: string;
    shown: NonNullable<ReturnType<typeof shownAudit>>;
    searchParams: PageProps<'/projects/[id]/audit'>['searchParams'];
}

export default async function AuditFindings({
    projectId,
    shown,
    searchParams,
}: Readonly<AuditFindingsProps>) {
    const query = findingListQuery.parse(await searchParams);
    const { audit, isFinished, isLatest } = shown;

    await getCurrentUser();

    const isOpen = query.check !== undefined || query.site_page !== undefined;

    const [list, sitePage, marks, locales] = await Promise.all([
        getFindingList(audit.id, query),
        query.site_page ? getSitePage(projectId, query.site_page) : null,
        isLatest ? getMarks(projectId) : [],
        getProjectLocales(projectId),
    ]);

    const lastPage =
        list.total === null
            ? 1
            : Math.max(1, Math.ceil(list.total / query.size));

    if (list.total === null || query.page > lastPage) {
        redirect(findingListHref(projectId, { ...query, page: lastPage }));
    }

    const closed = {
        ...query,
        check: undefined,
        site_page: undefined,
        page: 1,
    };

    const marking = { projectId, marks, canMark: isLatest };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Findings</CardTitle>
                {!isLatest && (
                    <CardDescription>
                        From the audit of {formatDate(audit.created_at)}, the
                        last one that ended.
                    </CardDescription>
                )}
                {isLatest && !isFinished && (
                    <CardDescription>
                        From the pages read before the audit stopped.
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {isOpen ? (
                    <BackLink href={findingListHref(projectId, closed)}>
                        {query.view === 'page' ? 'All pages' : 'All findings'}
                    </BackLink>
                ) : (
                    <div className="flex gap-2">
                        {views.map((view) => (
                            <Button
                                key={view.value}
                                variant={
                                    query.view === view.value
                                        ? 'secondary'
                                        : 'ghost'
                                }
                                nativeButton={false}
                                render={
                                    <Link
                                        href={findingListHref(projectId, {
                                            view: view.value,
                                            locale: query.locale,
                                            size: query.size,
                                        })}
                                    />
                                }
                            >
                                {view.label}
                            </Button>
                        ))}
                    </div>
                )}
                {!isOpen && (
                    <FindingFilters
                        projectId={projectId}
                        query={query}
                        locales={locales.map((locale) => locale.locale)}
                    />
                )}
                {list.kind === 'check' && (
                    <CheckTable
                        projectId={projectId}
                        rows={list.rows}
                        query={query}
                    />
                )}
                {list.kind === 'site-page' && (
                    <SitePageTable
                        projectId={projectId}
                        rows={list.rows}
                        query={query}
                    />
                )}
                {list.kind === 'finding' && query.check && (
                    <>
                        <CheckHeader check={query.check} {...marking} />
                        <CheckFindings findings={list.rows} {...marking} />
                    </>
                )}
                {list.kind === 'finding' &&
                    !query.check &&
                    (sitePage ? (
                        <>
                            <SitePageHeader sitePage={sitePage} />
                            <PageFindings findings={list.rows} {...marking} />
                        </>
                    ) : (
                        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                            This project has no page at this link. Open a page
                            from the list.
                        </p>
                    ))}
                <PagePagination
                    query={query}
                    total={list.total}
                    hrefOf={(change) =>
                        findingListHref(projectId, { ...query, ...change })
                    }
                />
            </CardContent>
        </Card>
    );
}

const views = [
    { value: 'finding', label: 'By finding' },
    { value: 'page', label: 'By page' },
] as const;

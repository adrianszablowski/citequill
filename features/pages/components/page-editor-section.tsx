import { notFound } from 'next/navigation';

import BackLink from '@/components/back-link';
import { getCurrentUser } from '@/features/auth/queries';
import LanguageVersions from '@/features/pages/components/language-versions';
import PageEditor from '@/features/pages/components/page-editor';
import { getPage, getPageVersions } from '@/features/pages/queries';
import { getAuthors, getProjectLocales } from '@/features/projects/queries';
import { publishCheck } from '@/features/publishing/check';
import { versionState } from '@/features/publishing/state';
import { sectionHref } from '@/lib/sections';

interface PageEditorSectionProps {
    params: Promise<{ id: string; pageId: string }>;
}

export default async function PageEditorSection({
    params,
}: Readonly<PageEditorSectionProps>) {
    const { id, pageId } = await params;

    await getCurrentUser();

    const page = await getPage(id, pageId);

    if (!page) {
        notFound();
    }

    const [authors, locales, versions] = await Promise.all([
        getAuthors(id),
        getProjectLocales(id),
        getPageVersions(id, [page.translation_group_id]),
    ]);

    const check = publishCheck(page, locales);

    return (
        <div className="flex flex-col gap-4">
            <BackLink href={sectionHref(id, 'pages')}>Back to Pages</BackLink>
            <PageEditor
                projectId={id}
                page={page}
                authors={authors.map(({ id: authorId, name }) => ({
                    id: authorId,
                    name,
                }))}
                state={versionState(page)}
                block={check.error ?? null}
                versions={
                    <LanguageVersions
                        projectId={id}
                        pageId={page.id}
                        versions={versions}
                    />
                }
            />
        </div>
    );
}

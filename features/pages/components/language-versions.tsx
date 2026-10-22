import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import type { PageVersion } from '@/features/pages/queries';
import {
    isOutOfDate,
    stateNames,
    versionState,
} from '@/features/publishing/state';
import { pageHref } from '@/lib/sections';

interface LanguageVersionsProps {
    projectId: string;
    pageId: string;
    versions: PageVersion[];
}

export default function LanguageVersions({
    projectId,
    pageId,
    versions,
}: Readonly<LanguageVersionsProps>) {
    return (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {versions.map((version) => (
                <li key={version.id} className="flex items-center gap-1.5">
                    {version.id === pageId ? (
                        <span className="font-medium">{version.locale}</span>
                    ) : (
                        <Link
                            href={pageHref(projectId, version.id)}
                            className="font-medium underline-offset-4 hover:underline"
                        >
                            {version.locale}
                        </Link>
                    )}
                    <span className="text-muted-foreground">
                        {stateNames[versionState(version)]}
                    </span>
                    {isOutOfDate(version, versions) && (
                        <Badge variant="outline">
                            Another language version has newer content
                        </Badge>
                    )}
                </li>
            ))}
        </ul>
    );
}

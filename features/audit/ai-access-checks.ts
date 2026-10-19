import type { Finding } from '@/features/audit/finding';
import { bingbotDirectives, snippetLimit } from '@/features/audit/observe';
import type { AuditPage } from '@/features/audit/page';
import type { PageCheckContext } from '@/features/audit/page-checks';
import type { Fetched } from '@/features/crawl/fetch';

export const smallSnippet = 160;

export function aiAccessChecks(
    url: string,
    fetched: Fetched,
    page: AuditPage | null,
    directives: string[],
    { aiSearchBlocked }: Pick<PageCheckContext, 'aiSearchBlocked'>,
): Finding[] {
    const findings: Finding[] = [];
    const agents = aiSearchBlocked(url);

    if (agents.length > 0) {
        findings.push({
            check: 'ai-search-bots-blocked',
            url,
            detail: { agents },
        });
    }

    const silenced = directives.filter(
        (directive) =>
            directive === 'nosnippet' || snippetLimit(directive) === 0,
    );

    if (silenced.length > 0) {
        findings.push({
            check: 'nosnippet',
            url,
            detail: { reason: 'directive', directives: silenced },
        });
    } else if (page?.nosnippet) {
        findings.push({
            check: 'nosnippet',
            url,
            selector: page.nosnippet,
            detail: { reason: 'data-nosnippet' },
        });
    }

    const small = directives.filter((directive) => {
        const limit = snippetLimit(directive);

        return typeof limit === 'number' && limit >= 1 && limit < smallSnippet;
    });

    if (small.length > 0 && silenced.length === 0) {
        findings.push({
            check: 'max-snippet-small',
            url,
            detail: { directives: small },
        });
    }

    const meta = bingbotArchive(
        bingbotDirectives(page?.bingbotMeta ?? [], null),
    );

    const header = bingbotArchive(
        bingbotDirectives([], fetched.headers.get('x-robots-tag')),
    );

    const archive = (['nocache', 'noarchive'] as const).find(
        (directive) => meta.includes(directive) || header.includes(directive),
    );

    if (archive) {
        findings.push({ check: archive, url, detail: { meta, header } });
    }

    return findings;
}

function bingbotArchive(directives: string[]) {
    return [
        ...new Set(
            directives.filter(
                (directive) =>
                    directive === 'nocache' || directive === 'noarchive',
            ),
        ),
    ];
}

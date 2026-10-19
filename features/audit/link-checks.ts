import { isGenericAnchor } from '@/features/audit/anchors';
import { cappedPerPage, type Finding } from '@/features/audit/finding';
import type { Anchor, AuditPage } from '@/features/audit/page';
import { isSiteUrl, withoutSlash } from '@/features/audit/queue';

export interface LinkContext {
    hosts: string[];
}

export const linkCountLimit = 3_000;

export function linkChecks(
    url: string,
    page: AuditPage,
    { hosts }: LinkContext,
): Finding[] {
    const { anchors } = page;

    const isInternal = (anchor: Anchor) =>
        anchor.url !== null && isSiteUrl(anchor.url, hosts);

    const label = (anchor: Anchor) => anchor.text || anchor.name;
    const self = withoutSlash(url);

    return [
        ...anchorFindings(
            'link-uncrawlable',
            url,
            anchors.filter(
                (anchor) =>
                    (anchor.href === null &&
                        (anchor.text !== '' || anchor.hasImage)) ||
                    /^javascript:/i.test(anchor.href?.trim() ?? ''),
            ),
        ),
        ...anchorFindings(
            'link-malformed',
            url,
            anchors.filter(
                (anchor) =>
                    anchor.href !== null && isMalformedHref(anchor.href, url),
            ),
        ),
        ...anchorFindings(
            'link-nofollow-internal',
            url,
            anchors.filter(
                (anchor) =>
                    isInternal(anchor) && anchor.rel.includes('nofollow'),
            ),
        ),
        ...anchorFindings(
            'anchor-generic',
            url,
            anchors.filter(
                (anchor) =>
                    isInternal(anchor) && isGenericAnchor(label(anchor)),
            ),
        ),
        ...anchorFindings(
            'anchor-empty',
            url,
            anchors.filter((anchor) => anchor.href !== null && !label(anchor)),
        ),
        ...(anchors.some(
            (anchor) =>
                isInternal(anchor) && withoutSlash(anchor.url!) !== self,
        )
            ? []
            : [{ check: 'page-no-outlinks' as const, url }]),
        ...linkCountFindings(url, anchors),
    ];
}

export function isMalformedHref(href: string, base: string) {
    const value = href.trim();

    if (value === '' || /^file:/i.test(value) || value.startsWith('\\\\')) {
        return true;
    }

    try {
        return localHosts.has(new URL(value, base).hostname);
    } catch {
        return true;
    }
}

function anchorFindings(
    check: Finding['check'],
    url: string,
    anchors: Anchor[],
): Finding[] {
    return cappedPerPage(
        anchors.map((anchor) => ({
            check,
            url,
            subject: anchor.href,
            selector: anchor.selector,
            snippet: anchor.snippet,
        })),
    );
}

function linkCountFindings(url: string, anchors: Anchor[]): Finding[] {
    const count = anchors.filter((anchor) => anchor.href !== null).length;

    return count > linkCountLimit
        ? [{ check: 'link-count', url, detail: { links: count } }]
        : [];
}

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

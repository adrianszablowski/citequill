import { createHash } from 'node:crypto';

import { type CheckId, checkOf } from '@/features/audit/catalogue';
import type { Json, TablesInsert } from '@/lib/types/database';

export interface Finding {
    check: CheckId;
    url: string | null;
    subject?: string | null;
    selector?: string | null;
    snippet?: string | null;
    detail?: Json;
}

export interface FindingContext {
    projectId: string;
    auditId: string;
    pageIds: ReadonlyMap<string, string>;
}

export interface Tag {
    name: string;
    attribs: Record<string, string>;
}

export const snippetLength = 200;

export const findingsPerPage = 20;

export function findingRows(
    findings: Finding[],
    { projectId, auditId, pageIds }: FindingContext,
): TablesInsert<'audit_findings'>[] {
    return findings.map(
        ({
            check,
            url,
            subject = null,
            selector = null,
            snippet = null,
            detail = null,
        }) => {
            const sitePageId = url === null ? null : (pageIds.get(url) ?? null);

            return {
                audit_id: auditId,
                project_id: projectId,
                site_page_id: sitePageId,
                check,
                severity: checkOf(check).severity,
                subject,
                selector,
                snippet: snippet === null ? null : snippetOf(snippet),
                detail,
                fingerprint: fingerprint(check, sitePageId, subject, selector),
            };
        },
    );
}

export function cappedPerPage(findings: Finding[]): Finding[] {
    const seen = new Set<string>();
    const groups = new Map<string, Finding[]>();

    for (const finding of findings) {
        const key = [
            finding.check,
            finding.url,
            finding.subject,
            finding.selector,
        ].join('\n');

        if (!seen.has(key)) {
            seen.add(key);

            const group = `${finding.check}\n${finding.url}`;

            groups.set(group, [...(groups.get(group) ?? []), finding]);
        }
    }

    return [...groups.values()].flatMap((group) =>
        group.slice(0, findingsPerPage).map((finding) =>
            group.length > findingsPerPage
                ? {
                      ...finding,
                      detail: {
                          ...(finding.detail as Record<string, Json>),
                          total: group.length,
                      },
                  }
                : finding,
        ),
    );
}

export function fingerprint(
    check: string,
    sitePageId: string | null,
    subject: string | null,
    selector: string | null,
) {
    return createHash('sha256')
        .update(
            [check, sitePageId, subject, selector]
                .map((part) => part ?? '')
                .join('\n'),
        )
        .digest('hex');
}

export function selectorOf({ name, attribs }: Tag) {
    const id = attribs.id?.trim();
    const classes = (attribs.class ?? '').split(/\s+/).filter(Boolean);

    return [
        name,
        id ? `#${id}` : '',
        ...classes.map((token) => `.${token}`),
    ].join('');
}

export function isTemplateSelector(selector: string) {
    return /[#.]/.test(selector);
}

export function snippetOf(html: string) {
    const text = html.replace(/\s+/g, ' ').trim();

    return text.length > snippetLength
        ? `${text.slice(0, snippetLength - 1)}…`
        : text;
}

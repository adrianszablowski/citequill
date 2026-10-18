import { type Finding, findingsPerPage } from '@/features/audit/finding';
import type { AuditPage, PageElement } from '@/features/audit/page';
import { isHttpUrl, isSiteUrl } from '@/features/audit/queue';
import { type Fetched, isHtml } from '@/features/crawl/fetch';
import type { Json } from '@/lib/types/database';

export interface HttpsContext {
    hosts: string[];
    homes: string[];
}

export function httpsChecks(
    url: string,
    fetched: Pick<Fetched, 'headers' | 'body'>,
    page: AuditPage | null,
    { hosts, homes }: HttpsContext,
): Finding[] {
    const isHttps = !isHttpUrl(url);

    return [
        ...(isHttps
            ? []
            : [
                  {
                      check: 'https-missing' as const,
                      url,
                      detail: { reason: 'served' },
                  },
              ]),
        ...contentTypeFindings(url, fetched),
        ...(homes.includes(url)
            ? securityHeaderFindings(url, fetched.headers, isHttps)
            : []),
        ...(page
            ? [
                  ...(isHttps ? mixedFindings(url, page, hosts) : []),
                  ...formFindings(url, page, isHttps),
              ]
            : []),
    ];
}

function contentTypeFindings(
    url: string,
    { headers, body }: Pick<Fetched, 'headers' | 'body'>,
): Finding[] {
    return !isHtml(headers) && htmlStart.test(body)
        ? [
              {
                  check: 'content-type-wrong',
                  url,
                  detail: { contentType: headers.get('content-type') },
              },
          ]
        : [];
}

function securityHeaderFindings(
    url: string,
    headers: Headers,
    isHttps: boolean,
): Finding[] {
    const policy = headers.get('content-security-policy');

    const present = {
        'strict-transport-security':
            !isHttps || headers.has('strict-transport-security'),
        'content-security-policy': policy !== null,
        'x-content-type-options': headers.has('x-content-type-options'),
        'x-frame-options':
            headers.has('x-frame-options') ||
            /frame-ancestors/i.test(policy ?? ''),
        'referrer-policy': headers.has('referrer-policy'),
    };

    const missing = Object.entries(present).flatMap(([name, isPresent]) =>
        isPresent ? [] : [name],
    );

    return missing.length > 0
        ? [{ check: 'security-headers', url, detail: { missing } }]
        : [];
}

function mixedFindings(url: string, page: AuditPage, hosts: string[]) {
    const overHttp = page.resources.filter(isOverHttp);

    return [
        ...located(
            'mixed-active',
            url,
            overHttp.filter(({ kind }) => activeKinds.has(kind)),
            (resource) => resource.url,
        ),
        ...located(
            'mixed-passive',
            url,
            [
                ...overHttp.filter(({ kind }) => !activeKinds.has(kind)),
                ...page.anchors.filter(
                    (anchor) =>
                        isOverHttp(anchor) && isSiteUrl(anchor.url!, hosts),
                ),
            ],
            (element) => element.url,
            (element) => ({ reason: 'kind' in element ? 'resource' : 'link' }),
        ),
    ];
}

function formFindings(
    url: string,
    { forms, hasLonePassword }: AuditPage,
    isHttps: boolean,
): Finding[] {
    const reason = isHttps ? 'http-action' : 'http-page';

    return [
        ...located(
            'form-on-http',
            url,
            isHttps
                ? forms.filter((form) => isOverHttp({ url: form.action }))
                : forms,
            (form) => form.action,
            (form) => ({ reason, hasPassword: form.hasPassword }),
        ),
        ...(!isHttps && hasLonePassword
            ? [
                  {
                      check: 'form-on-http' as const,
                      url,
                      detail: { reason, hasPassword: true },
                  },
              ]
            : []),
    ];
}

function isOverHttp({ url }: { url: string | null }) {
    return url !== null && isHttpUrl(url);
}

function located<Item extends PageElement>(
    check: Finding['check'],
    url: string,
    elements: Item[],
    subjectOf: (element: Item) => string | null,
    detailOf: (element: Item) => Record<string, Json> = () => ({}),
): Finding[] {
    const distinct = new Map<string | null, Item>();

    for (const element of elements) {
        const subject = subjectOf(element);

        if (!distinct.has(subject)) {
            distinct.set(subject, element);
        }
    }

    return [...distinct]
        .slice(0, findingsPerPage)
        .map(([subject, element]) => ({
            check,
            url,
            subject,
            selector: element.selector,
            snippet: element.snippet,
            detail: { ...detailOf(element), total: distinct.size },
        }));
}

const activeKinds = new Set(['script', 'stylesheet', 'iframe']);

const htmlStart = /^\uFEFF?\s*<(?:!doctype html|html)/i;

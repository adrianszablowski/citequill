import type { Finding } from '@/features/audit/finding';
import type { AuditPage } from '@/features/audit/page';
import type { Resource } from '@/features/audit/resources';
import { type Fetched, isHtml } from '@/features/crawl/fetch';

export const slowHtmlMs = 800;

export const uncompressedMinBytes = 1_024;

export const domSizeElements = 1_500;

export const heavyAssetFiles = 100;

export const heavyAssetBytes = 2_000_000;

export function auditRegion() {
    return process.env.VERCEL_REGION || 'local';
}

export function isHtmlAnswer(fetched: Fetched) {
    return (
        fetched.status === 200 &&
        fetched.hops.length === 1 &&
        isHtml(fetched.headers)
    );
}

export function isSlowRead(fetched: Fetched) {
    return isHtmlAnswer(fetched) && fetched.headersMs > slowHtmlMs;
}

export function performanceChecks(
    url: string,
    fetched: Fetched,
    page: Pick<AuditPage, 'elementCount' | 'assets'>,
    secondReadMs: number | undefined,
): Finding[] {
    const findings: Finding[] = [];
    const bytes = Buffer.byteLength(fetched.body);

    if (
        isSlowRead(fetched) &&
        secondReadMs !== undefined &&
        secondReadMs > slowHtmlMs
    ) {
        findings.push({
            check: 'html-slow',
            url,
            detail: {
                ms: [fetched.headersMs, secondReadMs],
                region: auditRegion(),
            },
        });
    }

    if (
        !fetched.headers.has('content-encoding') &&
        bytes > uncompressedMinBytes
    ) {
        findings.push({ check: 'html-uncompressed', url, detail: { bytes } });
    }

    if (page.elementCount > domSizeElements) {
        findings.push({
            check: 'dom-size',
            url,
            detail: { elements: page.elementCount },
        });
    }

    if (page.assets.length > heavyAssetFiles) {
        findings.push({
            check: 'assets-heavy',
            url,
            detail: { reason: 'files', files: page.assets.length },
        });
    }

    return findings;
}

export function assetWeightChecks(
    homes: string[],
    answered: Pick<Resource, 'linked_from' | 'content_length'>[],
): Finding[] {
    return homes.flatMap((home): Finding[] => {
        const used = answered.filter((asset) =>
            asset.linked_from.includes(home),
        );

        const bytes = used.reduce(
            (sum, asset) => sum + (asset.content_length ?? 0),
            0,
        );

        return bytes > heavyAssetBytes
            ? [
                  {
                      check: 'assets-heavy',
                      url: home,
                      detail: { reason: 'bytes', bytes, files: used.length },
                  },
              ]
            : [];
    });
}

import type { Finding } from '@/features/audit/finding';
import { googlebotBlocks, type RobotsFile } from '@/features/audit/robots';

export const robotsByteCap = 500 * 1024;

export const robotsRedirectCap = 5;

export function robotsChecks(files: RobotsFile[], homes: string[]) {
    const origins = new Set(homes.map((home) => new URL(home).origin));
    const isBlocked = googlebotBlocks(files);

    return [
        ...files
            .filter((file) => origins.has(new URL(file.url).origin))
            .flatMap(fileFindings),
        ...homes.filter(isBlocked).map((home): Finding => ({
            check: 'robots-googlebot-blocked',
            url: null,
            subject: home,
        })),
    ];
}

function fileFindings({ url, status, hops, bytes, groups }: RobotsFile) {
    const findings: Finding[] = [];
    const site = { url: null, subject: url };
    const redirects = Math.max(0, hops.length - 1);

    if (status === null || status >= 500) {
        findings.push({ ...site, check: 'robots-5xx', detail: { status } });
    } else if (status >= 400) {
        findings.push({ ...site, check: 'robots-4xx', detail: { status } });
    }

    if (bytes > robotsByteCap || redirects > robotsRedirectCap) {
        findings.push({
            ...site,
            check: 'robots-size',
            detail: { bytes, redirects },
        });
    }

    const unsupported = groups
        .flatMap((group) => group.rules)
        .filter((rule) => unsupportedFields.has(rule.directive));

    if (unsupported.length > 0) {
        findings.push({
            ...site,
            check: 'robots-unsupported',
            snippet: `${unsupported[0].directive}: ${unsupported[0].value}`,
            detail: { lines: unsupported.map(({ line }) => line) },
        });
    }

    return findings;
}

const unsupportedFields = new Set(['crawl-delay', 'noindex', 'host']);

import type { CheckId } from '@/features/audit/catalogue';
import type { Finding } from '@/features/audit/finding';
import {
    agentsBlocked,
    aiTrainingAgents,
    aiUserAgents,
    googlebotBlocks,
    type RobotsFile,
} from '@/features/audit/robots';

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
        ...agentFindings(
            'ai-training-bots-blocked',
            agentsBlocked(files, aiTrainingAgents),
            homes,
        ),
        ...agentFindings(
            'ai-user-agents-blocked',
            agentsBlocked(files, aiUserAgents),
            homes,
        ),
    ];
}

function agentFindings(
    check: CheckId,
    blocked: (url: string) => string[],
    homes: string[],
) {
    return homes.flatMap((home): Finding[] => {
        const agents = blocked(home);

        return agents.length > 0
            ? [{ check, url: null, subject: home, detail: { agents } }]
            : [];
    });
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

    const signals = new Map<string, string[]>();

    for (const { agents, rules } of groups) {
        for (const { directive, value } of rules) {
            if (directive === 'content-signal') {
                signals.set(value, [
                    ...(signals.get(value) ?? []),
                    ...(agents.length > 0 ? agents : [noAgent]),
                ]);
            }
        }
    }

    if (signals.size > 0) {
        findings.push({
            ...site,
            check: 'content-signals',
            detail: {
                signals: [...signals].map(
                    ([value, agents]) =>
                        `${value} (${[...new Set(agents)].join(', ')})`,
                ),
            },
        });
    }

    return findings;
}

const unsupportedFields = new Set(['crawl-delay', 'noindex', 'host']);

const noAgent = 'no User-agent';

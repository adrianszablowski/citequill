import robotsParser from 'robots-parser';

import { type Fetched, type Hop, userAgent } from '@/features/crawl/fetch';
import { sitemapsFromRobots } from '@/features/crawl/sitemap';

export interface RobotsRule {
    directive: string;
    value: string;
    line: number;
}

export interface RobotsGroup {
    agents: string[];
    rules: RobotsRule[];
}

export interface RobotsFile {
    url: string;
    status: number | null;
    hops: Hop[];
    bytes: number;
    groups: RobotsGroup[];
    sitemaps: string[];
}

export function robotsFile(
    url: string,
    fetched: Pick<Fetched, 'ok' | 'status' | 'hops' | 'body'> | null,
): RobotsFile {
    return {
        url,
        status: fetched?.status ?? null,
        hops: fetched?.hops ?? [],
        bytes: Buffer.byteLength(fetched?.body ?? ''),
        ...(fetched?.ok
            ? parseRobots(fetched.body)
            : { groups: [], sitemaps: [] }),
    };
}

export function parseRobots(text: string) {
    const groups: RobotsGroup[] = [];
    let isAgentRun = false;

    text.split(/\r\n|\r|\n/).forEach((raw, index) => {
        const [field, ...rest] = raw.replace(/#.*/, '').split(':');
        const directive = field.trim().toLowerCase();
        const value = rest.join(':').trim();

        if (rest.length === 0 || directive === 'sitemap') {
            return;
        }

        if (directive === 'user-agent') {
            if (!isAgentRun) {
                groups.push({ agents: [], rules: [] });
            }

            if (value) {
                groups.at(-1)!.agents.push(value);
            }

            isAgentRun = true;

            return;
        }

        if (groups.length === 0) {
            groups.push({ agents: [], rules: [] });
        }

        groups.at(-1)!.rules.push({ directive, value, line: index + 1 });
        isAgentRun = false;
    });

    return { groups, sitemaps: sitemapsFromRobots(text) };
}

export function blockedBy(files: RobotsFile[], obeyRobots: boolean) {
    const readers = robotsReaders(files);

    return (url: string) => {
        const reader = readerOf(readers, url);

        if (!reader) {
            return false;
        }

        const disallows = (agent: string) =>
            reader.robots.isAllowed(url, agent) === false;

        return (
            (obeyRobots && disallows('Googlebot')) ||
            (reader.hasOwnGroup && disallows(ownAgent))
        );
    };
}

export function googlebotBlocks(files: RobotsFile[]) {
    const readers = robotsReaders(files);

    return (url: string) =>
        readerOf(readers, url)?.robots.isAllowed(url, 'Googlebot') === false;
}

const ownAgent = agentToken(userAgent);

type RobotsReader = ReturnType<typeof robotsReaders>[number];

function robotsReaders(files: RobotsFile[]) {
    return files.map((file) => ({
        origin: new URL(file.url).origin,
        robots: robotsParser(file.url, robotsText(file.groups)),
        hasOwnGroup: ownGroups(file).length > 0,
    }));
}

function readerOf(readers: RobotsReader[], url: string) {
    return readers.find((reader) => reader.origin === new URL(url).origin);
}

function agentToken(agent: string) {
    return agent.toLowerCase().split('/')[0].trim();
}

function ownGroups(file: RobotsFile) {
    return file.groups.filter((group) =>
        group.agents.some((agent) => agentToken(agent) === ownAgent),
    );
}

function robotsText(groups: RobotsGroup[]) {
    return groups
        .flatMap((group) => [
            ...group.agents.map((agent) => `user-agent: ${agent}`),
            ...group.rules.map((rule) => `${rule.directive}: ${rule.value}`),
        ])
        .join('\n');
}

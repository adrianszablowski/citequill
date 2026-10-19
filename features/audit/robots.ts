import robotsParser from 'robots-parser';

import {
    chromeVersion,
    type Fetched,
    type Hop,
    userAgent,
} from '@/features/crawl/fetch';
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

export const aiSearchAgents = [
    'OAI-SearchBot',
    'Claude-SearchBot',
    'PerplexityBot',
    'Bingbot',
    'Applebot',
    'MistralAI-Index',
    'DuckAssistBot',
    'Amzn-SearchBot',
    'meta-webindexer',
    'Google-Extended',
];

// Anthropic prints no user agent for Claude-SearchBot and third-party lists
// disagree, so the test sends its token alone, which a rule matching the token
// meets as it meets the real agent.
export const cdnTestAgents = [
    [
        'OAI-SearchBot',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot',
    ],
    ['Claude-SearchBot', 'Claude-SearchBot'],
    [
        'PerplexityBot',
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    ],
    [
        'Applebot',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
    ],
    [
        'MistralAI-Index',
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Index/1.0; +https://docs.mistral.ai/robots)',
    ],
    [
        'DuckAssistBot',
        'DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)',
    ],
    [
        'Amzn-SearchBot',
        `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-SearchBot/0.1) Chrome/${chromeVersion} Safari/537.36`,
    ],
    ['meta-webindexer', 'meta-webindexer/1.1'],
].map(([agent, printed]) => ({ agent, userAgent: `${printed} ${userAgent}` }));

export const aiTrainingAgents = [
    'GPTBot',
    'ClaudeBot',
    'Meta-ExternalAgent',
    'Applebot-Extended',
    'MistralAI-Training',
    'Amazonbot',
    'CCBot',
];

export const aiUserAgents = [
    'ChatGPT-User',
    'Claude-User',
    'Perplexity-User',
    'MistralAI-User',
    'Amzn-User',
    'meta-externalfetcher',
];

export function agentsBlocked(files: RobotsFile[], agents: string[]) {
    const readers = robotsReaders(files);

    return (url: string) => {
        const reader = readerOf(readers, url);

        return reader
            ? agents.filter(
                  (agent) =>
                      reader.robots.isAllowed(
                          url,
                          groupAgent(reader, agent),
                      ) === false,
              )
            : [];
    };
}

const ownAgent = agentToken(userAgent);

type RobotsReader = ReturnType<typeof robotsReaders>[number];

function robotsReaders(files: RobotsFile[]) {
    return files.map((file) => {
        const agents = new Set(
            file.groups.flatMap((group) => group.agents.map(agentToken)),
        );

        return {
            origin: new URL(file.url).origin,
            robots: robotsParser(file.url, robotsText(file.groups)),
            agents,
            hasOwnGroup: agents.has(ownAgent),
        };
    });
}

function readerOf(readers: RobotsReader[], url: string) {
    return readers.find((reader) => reader.origin === new URL(url).origin);
}

// Apple says Applebot, and Amazon says Amzn-SearchBot, follows the rules given
// to Googlebot when no group names it, before the * group.
const googlebotFollowers = new Set(['applebot', 'amzn-searchbot']);

function groupAgent(reader: RobotsReader, agent: string) {
    const token = agentToken(agent);

    return googlebotFollowers.has(token) && !reader.agents.has(token)
        ? 'Googlebot'
        : agent;
}

function agentToken(agent: string) {
    return agent.toLowerCase().split('/')[0].trim();
}

// The empty disallow keeps a group of only Content-Signal lines from falling
// back to *, and an agentless group would join the one before; Google reads the
// first as allowing everything and the second as applying to no crawler.
function robotsText(groups: RobotsGroup[]) {
    return groups
        .filter((group) => group.agents.length > 0)
        .flatMap((group) => [
            ...group.agents.map((agent) => `user-agent: ${agent}`),
            'disallow:',
            ...group.rules.map((rule) => `${rule.directive}: ${rule.value}`),
        ])
        .join('\n');
}

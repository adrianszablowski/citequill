import { FatalError } from 'workflow';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import robotsParser from 'robots-parser';

import { observePage } from '@/features/audit/observe';
import { writeSitePages } from '@/features/audit/site-pages';
import { chunkText, pageChunks } from '@/features/crawl/budget';
import {
    defaultDeps,
    fetchPublic,
    fetchText,
    isHtml,
    userAgent,
} from '@/features/crawl/fetch';
import { type Alternate, readPage } from '@/features/crawl/html';
import {
    isSameLanguage,
    languagesSkill,
    localesFrom,
} from '@/features/crawl/locales';
import { linksFromLlmsText } from '@/features/crawl/markdown-source';
import { fetchPage } from '@/features/crawl/page';
import { guessPrefix } from '@/features/crawl/prefix';
import {
    type Facts,
    type FactSkillName,
    factsForSkill,
    factsSchema,
    factsSystemPrompt,
    mergeFacts,
    productSkillOutput,
    type ProductSkillOutput,
    productSkillSystemPrompt,
    productSkillUserPrompt,
} from '@/features/crawl/prompts';
import { pageCap, rankUrls } from '@/features/crawl/rank';
import type { Signals } from '@/features/crawl/signals';
import { sitemapEntries, sitemapsFromRobots } from '@/features/crawl/sitemap';
import {
    nothingFoundDescription,
    notFoundOnTheSite,
    type ProductSkillName,
} from '@/features/skills/product-skill';
import { starterKinds } from '@/features/skills/starter-kinds';
import { addUsage, markProgress } from '@/features/runs/steps';
import { createAnthropic, models } from '@/lib/anthropic';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/types/database';

export const batchSize = 5;

export const frontierCap = 400;

export const linksPerPage = 200;

export interface PageMeta {
    url: string;
    lang: string | null;
    alternates: Alternate[];
    author: string | null;
    links: string[];
}

export interface Site {
    origin: string;
    home: string;
    navLinks: string[];
    localePrefixes: string[];
    llmsLinks: string[];
    robotsText: string;
}

export interface Discovery extends Site {
    candidates: string[];
}

export interface Batch {
    batch: string[];
    candidates: string[];
}

export async function loadProject(projectId: string, runId: string) {
    'use step';

    await markProgress(runId);

    const { data, error } = await createAdminClient()
        .from('projects')
        .select('domain')
        .eq('id', projectId)
        .single();

    if (error) {
        throw new FatalError(error.message);
    }

    return data;
}

export async function clearCrawl(projectId: string, runId: string) {
    'use step';

    await markProgress(runId);

    const { error } = await createAdminClient()
        .from('crawled_pages')
        .delete()
        .eq('project_id', projectId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function discoverPages(
    runId: string,
    domain: string,
): Promise<Discovery> {
    'use step';

    await markProgress(runId);

    const home = await findHome(domain);
    const origin = new URL(home.url).origin;
    const robotsText = (await fetchText(`${origin}/robots.txt`)) ?? '';
    const llmsText = await fetchText(`${origin}/llms.txt`);
    const homePage = readPage(home.html, home.url);

    const sitemapPages = await pagesFromSitemaps(
        [...sitemapsFromRobots(robotsText), `${origin}/sitemap.xml`].filter(
            (url) => isSameSite(url, origin),
        ),
        origin,
    );

    const site: Site = {
        origin,
        home: home.url,
        navLinks: homePage.navLinks,
        localePrefixes: localesFrom(origin, [homePage])
            .filter(
                (locale) => !locale.is_default && locale.base_url !== origin,
            )
            .map((locale) => locale.base_url),
        llmsLinks: llmsText
            ? linksFromLlmsText(llmsText, `${origin}/llms.txt`)
            : [],
        robotsText: robotsText.slice(0, robotsChars),
    };

    return {
        ...site,
        candidates: rank(
            site,
            [],
            [...sitemapPages, ...homePage.links],
            frontierCap,
        ),
    };
}

export async function nextBatch(
    runId: string,
    site: Site,
    seen: string[],
    candidates: string[],
): Promise<Batch> {
    'use step';

    await markProgress(runId);

    const ranked = rank(site, seen, candidates, frontierCap + batchSize);

    return {
        batch: ranked.slice(0, Math.min(batchSize, pageCap - seen.length)),
        candidates: ranked.slice(batchSize),
    };
}

export async function fetchPages(
    projectId: string,
    runId: string,
    urls: string[],
    llmsLinks: string[],
): Promise<PageMeta[]> {
    'use step';

    await markProgress(runId);

    const supabase = createAdminClient();

    const pages = await Promise.all(
        urls.map(async (url) => {
            const page = await fetchPage(url, llmsLinks);

            const { error } = await supabase.from('crawled_pages').upsert(
                {
                    project_id: projectId,
                    url,
                    locale: page.lang,
                    title: page.title,
                    body: page.body.slice(0, bodyChars),
                    reader_body: page.readerBody?.slice(0, bodyChars) ?? null,
                    signals: page.signals as unknown as Json,
                    error: page.error,
                    crawled_at: new Date().toISOString(),
                },
                { onConflict: 'project_id,url' },
            );

            if (error) {
                throw new Error(error.message);
            }

            return { url, page };
        }),
    );

    await writeSitePages(
        pages.map(({ url, page }) => ({
            project_id: projectId,
            url,
            locale: page.lang,
            ...observePage(page.answer),
            is_blocked: false,
        })),
    );

    return pages.map(({ url, page }) => ({
        url,
        lang: page.lang,
        alternates: page.alternates,
        author: page.author,
        links: page.links.slice(0, linksPerPage),
    }));
}

export async function saveLocales(
    projectId: string,
    runId: string,
    origin: string,
    pages: PageMeta[],
) {
    'use step';

    await markProgress(runId);

    const supabase = createAdminClient();
    const locales = localesFrom(origin, pages);

    const { error: deleteError } = await supabase
        .from('project_locales')
        .delete()
        .eq('project_id', projectId);

    if (deleteError) {
        throw new Error(deleteError.message);
    }

    const { error } = await supabase
        .from('project_locales')
        .insert(
            locales.map((locale) => ({ project_id: projectId, ...locale })),
        );

    if (error) {
        throw new Error(error.message);
    }
}

export async function planChunks(
    projectId: string,
    runId: string,
): Promise<string[][]> {
    'use step';

    await markProgress(runId);

    const pages = await loadPages(projectId);

    if (pages.length === 0) {
        throw new FatalError('Citequill could not read any page of the site.');
    }

    const main = (await loadLocales(projectId)).find(
        (locale) => locale.is_default,
    )?.locale;

    const inMainLanguage = pages.filter((page) =>
        isSameLanguage(page.locale, main),
    );

    if (inMainLanguage.length === 0) {
        throw new FatalError(
            `No page Citequill read is in the site's main language (${main}).`,
        );
    }

    return pageChunks(inMainLanguage).map((chunk) =>
        chunk.map((page) => page.url),
    );
}

export async function extractFacts(
    projectId: string,
    runId: string,
    urls: string[],
): Promise<Facts> {
    'use step';

    await markProgress(runId);

    const pages = await loadPages(projectId, urls);

    const message = await createAnthropic().messages.parse({
        model: models.extractor,
        max_tokens: 16_000,
        system: factsSystemPrompt,
        messages: [{ role: 'user', content: chunkText(pages) }],
        output_config: { format: zodOutputFormat(factsSchema) },
    });

    await addUsage(runId, models.extractor, message.usage);

    if (!message.parsed_output) {
        throw new Error('The facts did not come back in the expected shape.');
    }

    return message.parsed_output;
}

export async function nameSite(
    projectId: string,
    runId: string,
    domain: string,
    home: string,
    parts: Facts[],
) {
    'use step';

    await markProgress(runId);

    const [homePage] = await loadPages(projectId, [home]);

    const siteName =
        homePage?.signals?.siteName ||
        mergeFacts(parts).site_name.trim() ||
        domain;

    const { error } = await createAdminClient()
        .from('projects')
        .update({ name: siteName })
        .eq('id', projectId);

    if (error) {
        throw new Error(error.message);
    }

    return siteName;
}

export async function writeProductSkill(
    projectId: string,
    runId: string,
    siteName: string,
    name: ProductSkillName,
    parts: Facts[],
) {
    'use step';

    await markProgress(runId);

    const supabase = createAdminClient();

    const { data: existing } = await supabase
        .from('skills')
        .select('id')
        .eq('project_id', projectId)
        .eq('is_product', true)
        .eq('name', name)
        .maybeSingle();

    if (existing) {
        return existing.id;
    }

    const skill =
        name === 'Languages'
            ? languagesSkill(await loadLocales(projectId))
            : await skillFromFacts(runId, siteName, name, parts);

    const { data, error } = await supabase
        .from('skills')
        .insert({ project_id: projectId, ...skill, name, is_product: true })
        .select('id')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return data.id;
}

export async function createStarterKinds(
    projectId: string,
    runId: string,
    urls: string[],
    authorName: string | null,
) {
    'use step';

    await markProgress(runId);

    const supabase = createAdminClient();

    const { count } = await supabase
        .from('page_kinds')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);

    if (count) {
        return;
    }

    let authorId: string | null = null;

    if (authorName) {
        const { data, error } = await supabase
            .from('authors')
            .insert({ project_id: projectId, name: authorName })
            .select('id')
            .single();

        if (error) {
            throw new Error(error.message);
        }

        authorId = data.id;
    }

    for (const kind of starterKinds) {
        const { data: skill, error: skillError } = await supabase
            .from('skills')
            .insert({
                project_id: projectId,
                name: kind.name,
                description: kind.description,
                body: kind.body,
            })
            .select('id')
            .single();

        if (skillError) {
            throw new Error(skillError.message);
        }

        const { error } = await supabase.from('page_kinds').insert({
            project_id: projectId,
            name: kind.name,
            url_prefix: guessPrefix(kind.prefixes, urls),
            skill_id: skill.id,
            author_id: authorId,
        });

        if (error) {
            throw new Error(error.message);
        }
    }
}

const sitemapCap = 10;

const skillTokens = 32_000;

const descriptionChars = 200;

const bodyChars = 100_000;

const robotsChars = 50_000;

interface Home {
    url: string;
    html: string;
}

async function findHome(domain: string): Promise<Home> {
    for (const candidate of [
        `https://${domain}/`,
        `https://www.${domain}/`,
        `http://${domain}/`,
    ]) {
        try {
            const response = await fetchPublic(candidate);

            if (response.ok && isHtml(response.headers)) {
                return { url: response.url, html: response.body };
            }
        } catch {
            continue;
        }
    }

    throw new FatalError(
        `The site did not answer at https://${domain} or https://www.${domain}.`,
    );
}

async function loadLocales(projectId: string) {
    const { data, error } = await createAdminClient()
        .from('project_locales')
        .select('locale, base_url, is_default')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

async function skillFromFacts(
    runId: string,
    siteName: string,
    name: FactSkillName,
    parts: Facts[],
) {
    const facts = factsForSkill(mergeFacts(parts), name);

    return facts.length === 0
        ? { description: nothingFoundDescription, body: notFoundOnTheSite }
        : askForSkill(runId, siteName, name, facts);
}

async function askForSkill(
    runId: string,
    siteName: string,
    name: FactSkillName,
    facts: string[],
): Promise<ProductSkillOutput> {
    const message = await createAnthropic()
        .messages.stream({
            model: models.writer,
            max_tokens: skillTokens,
            system: productSkillSystemPrompt(name, siteName),
            messages: [
                { role: 'user', content: productSkillUserPrompt(facts) },
            ],
            output_config: { format: zodOutputFormat(productSkillOutput) },
        })
        .finalMessage();

    await addUsage(runId, models.writer, message.usage);

    if (message.stop_reason === 'max_tokens') {
        throw new FatalError(
            `The "${name}" skill was too long to write in one answer.`,
        );
    }

    const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

    const skill = productSkillOutput.parse(JSON.parse(text));

    return {
        description: skill.description.trim().slice(0, descriptionChars),
        body: skill.body.trim(),
    };
}

function isSameSite(url: string, origin: string) {
    try {
        return (
            new URL(url).hostname.replace(/^www\./, '') ===
            new URL(origin).hostname.replace(/^www\./, '')
        );
    } catch {
        return false;
    }
}

async function pagesFromSitemaps(sitemaps: string[], origin: string) {
    let queue = [...new Set(sitemaps)];
    const seen = new Set<string>();
    let pages: string[] = [];

    while (queue.length > 0 && seen.size < sitemapCap) {
        const url = queue.shift()!;

        if (seen.has(url)) {
            continue;
        }

        seen.add(url);

        const fetched = await fetchPublic(url, defaultDeps, {
            isSitemap: true,
        }).catch(() => null);

        if (!fetched?.ok) {
            continue;
        }

        const entries = sitemapEntries(fetched.body, fetched.isTruncated);

        pages = pages.concat(entries.pages);

        queue = queue.concat(
            entries.sitemaps.filter((child) => isSameSite(child, origin)),
        );
    }

    return pages;
}

function rank(site: Site, seen: string[], candidates: string[], count: number) {
    const robots = robotsParser(`${site.origin}/robots.txt`, site.robotsText);

    return rankUrls(
        {
            home: site.home,
            candidates: candidates.filter(
                (url) => robots.isAllowed(url, userAgent) !== false,
            ),
            navLinks: site.navLinks,
            localePrefixes: site.localePrefixes,
            seen,
        },
        count,
    );
}

async function loadPages(projectId: string, urls?: string[]) {
    let query = createAdminClient()
        .from('crawled_pages')
        .select('url, locale, title, body, reader_body, signals')
        .eq('project_id', projectId)
        .is('error', null)
        .order('crawled_at');

    if (urls) {
        query = query.in('url', urls);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    const pages = data.map(({ reader_body, signals, ...page }) => ({
        ...page,
        readerBody: reader_body,
        signals: signals as unknown as Signals | null,
    }));

    return urls
        ? urls.flatMap((url) => pages.filter((page) => page.url === url))
        : pages;
}

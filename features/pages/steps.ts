import { FatalError } from 'workflow';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { languageName } from '@/features/crawl/locales';
import {
    internalLinkFindings,
    slugify,
    uniqueSlug,
} from '@/features/pages/draft';
import {
    type Brief,
    briefSchema,
    briefSystemPrompt,
    briefUserPrompt,
    checkOutput,
    checkSystemPrompt,
    checkUserPrompt,
    correctUserPrompt,
    findingsFrom,
    type PageOutput,
    pageOutput,
    type WriteContext,
    writeSystemPrompt,
    writeUserPrompt,
} from '@/features/pages/prompts';
import { addUsage, markProgress } from '@/features/runs/steps';
import { createAnthropic, models } from '@/lib/anthropic';
import { createAdminClient } from '@/lib/supabase/admin';
import { one } from '@/lib/supabase/result';

export interface WriteTarget {
    context: WriteContext;
    kindId: string;
    authorId: string | null;
}

export async function loadWriteContext(
    projectId: string,
    runId: string,
): Promise<WriteTarget> {
    'use step';

    await markProgress(runId);

    const supabase = createAdminClient();

    const [run, project, skills, kinds, locales, crawled, published] =
        await Promise.all([
            one(
                supabase
                    .from('runs')
                    .select('topic, kind_id, locale')
                    .eq('id', runId)
                    .eq('project_id', projectId)
                    .single(),
            ),
            one(
                supabase
                    .from('projects')
                    .select('name')
                    .eq('id', projectId)
                    .single(),
            ),
            one(
                supabase
                    .from('skills')
                    .select('id, name, description, body, is_product')
                    .eq('project_id', projectId),
            ),
            one(
                supabase
                    .from('page_kinds')
                    .select(
                        'id, name, url_prefix, skill_id, author_id, skills(name, description, body)',
                    )
                    .eq('project_id', projectId),
            ),
            one(
                supabase
                    .from('project_locales')
                    .select('locale, base_url, is_default')
                    .eq('project_id', projectId),
            ),
            one(
                supabase
                    .from('crawled_pages')
                    .select('url, title')
                    .eq('project_id', projectId)
                    .is('error', null),
            ),
            one(
                supabase
                    .from('published_pages')
                    .select('url, title, pages!inner(status)')
                    .eq('project_id', projectId)
                    .eq('pages.status', 'published'),
            ),
        ]);

    const kind = kinds.find((candidate) => candidate.id === run.kind_id);

    if (!run.topic || !kind) {
        throw new FatalError('The run has no topic or its kind is gone.');
    }

    const locale =
        locales.find((candidate) => candidate.locale === run.locale) ??
        locales.find((candidate) => candidate.is_default) ??
        locales[0];

    if (!locale) {
        throw new FatalError('The project has no language to write in.');
    }

    const kindSkillIds = new Set(kinds.map((candidate) => candidate.skill_id));

    return {
        context: {
            siteName: project.name,
            origin: locale.base_url,
            locale: locale.locale,
            languageName: languageName(locale.locale),
            topic: run.topic,
            kind: { name: kind.name, skill: kind.skills },
            customSkills: skills.filter(
                (skill) => !skill.is_product && !kindSkillIds.has(skill.id),
            ),
            productSkills: skills.filter((skill) => skill.is_product),
            sitePages: [
                ...crawled,
                ...published.map(({ url, title }) => ({ url, title })),
            ],
        },
        kindId: kind.id,
        authorId: kind.author_id,
    };
}

export async function writeBrief(
    runId: string,
    context: WriteContext,
): Promise<Brief> {
    'use step';

    await markProgress(runId);

    const client = createAnthropic();

    const messages: MessageParam[] = [
        { role: 'user', content: briefUserPrompt(context.topic) },
    ];

    for (let turn = 0; turn < briefTurns; turn += 1) {
        const message = await client.messages.create({
            model: models.writer,
            max_tokens: briefTokens,
            system: briefSystemPrompt(context),
            messages,
            tools: [
                {
                    type: 'web_search_20260318',
                    name: 'web_search',
                    max_uses: searchesPerBrief,
                },
            ],
            output_config: { format: zodOutputFormat(briefSchema) },
        });

        await addUsage(runId, models.writer, message.usage);

        if (message.stop_reason === 'pause_turn') {
            messages.push({ role: 'assistant', content: message.content });

            continue;
        }

        if (message.stop_reason === 'max_tokens') {
            throw new FatalError(
                'The brief was too long to write in one answer.',
            );
        }

        return briefSchema.parse(JSON.parse(textOf(message.content)));
    }

    throw new FatalError('The brief did not finish its research.');
}

export async function writeDraft(
    runId: string,
    context: WriteContext,
    brief: Brief,
) {
    'use step';

    await markProgress(runId);

    return askForPage(
        runId,
        writeSystemPrompt(context, brief),
        writeUserPrompt(brief),
    );
}

export async function correctDraft(
    runId: string,
    context: WriteContext,
    brief: Brief,
    page: PageOutput,
    findings: string[],
) {
    'use step';

    await markProgress(runId);

    return askForPage(
        runId,
        writeSystemPrompt(context, brief),
        correctUserPrompt(page, findings),
    );
}

export async function checkDraft(
    runId: string,
    context: WriteContext,
    page: PageOutput,
) {
    'use step';

    await markProgress(runId);

    const message = await createAnthropic().messages.parse({
        model: models.extractor,
        max_tokens: checkTokens,
        system: checkSystemPrompt(context),
        messages: [{ role: 'user', content: checkUserPrompt(page) }],
        output_config: { format: zodOutputFormat(checkOutput) },
    });

    await addUsage(runId, models.extractor, message.usage);

    if (!message.parsed_output) {
        throw new Error('The check did not come back in the expected shape.');
    }

    return findingsFrom(
        message.parsed_output,
        internalLinkFindings(
            page.body_md,
            context.origin,
            context.sitePages.map((sitePage) => sitePage.url),
        ),
    );
}

export async function saveDraft(
    projectId: string,
    runId: string,
    target: WriteTarget,
    page: PageOutput,
    findings: string[],
) {
    'use step';

    await markProgress(runId);

    const supabase = createAdminClient();

    const taken = await one(
        supabase
            .from('pages')
            .select('slug')
            .eq('project_id', projectId)
            .eq('locale', target.context.locale),
    );

    const { data, error } = await supabase
        .from('pages')
        .insert({
            project_id: projectId,
            kind_id: target.kindId,
            locale: target.context.locale,
            slug: uniqueSlug(
                slugify(page.slug) || slugify(page.title),
                taken.map((row) => row.slug),
            ),
            title: page.title,
            meta_title: page.meta_title,
            meta_description: page.meta_description,
            excerpt: page.excerpt,
            body_md: page.body_md,
            faq: page.faq,
            sources: page.sources,
            tags: page.tags,
            author_id: target.authorId,
            check_note: findings.length > 0 ? findings.join('\n') : null,
            run_id: runId,
        })
        .select('id')
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return data.id;
}

async function askForPage(runId: string, system: string, user: string) {
    const message = await createAnthropic()
        .messages.stream({
            model: models.writer,
            max_tokens: pageTokens,
            system,
            messages: [{ role: 'user', content: user }],
            output_config: { format: zodOutputFormat(pageOutput) },
        })
        .finalMessage();

    await addUsage(runId, models.writer, message.usage);

    if (message.stop_reason === 'max_tokens') {
        throw new FatalError('The page was too long to write in one answer.');
    }

    return pageOutput.parse(JSON.parse(textOf(message.content)));
}

function textOf(content: { type: string; text?: string }[]) {
    return content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('');
}

const briefTurns = 3;

const briefTokens = 8_000;

const pageTokens = 16_000;

const checkTokens = 8_000;

const searchesPerBrief = 5;

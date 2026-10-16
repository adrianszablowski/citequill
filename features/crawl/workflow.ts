import { pageCap } from '@/features/crawl/rank';
import {
    clearCrawl,
    createStarterKinds,
    discoverPages,
    extractFacts,
    fetchPages,
    loadProject,
    nameSite,
    nextBatch,
    type PageMeta,
    planChunks,
    saveLocales,
    writeProductSkill,
} from '@/features/crawl/steps';
import { failRun, finishRun } from '@/features/runs/steps';
import { productSkillNames } from '@/features/skills/product-skill';

export async function crawlSite(projectId: string, runId: string) {
    'use workflow';

    try {
        const { domain } = await loadProject(projectId);

        await clearCrawl(projectId);

        const { candidates: initial, ...site } = await discoverPages(domain);
        const seen: string[] = [];
        const pages: PageMeta[] = [];
        let candidates = initial;

        while (seen.length < pageCap) {
            const next = await nextBatch(site, seen, candidates);

            if (next.batch.length === 0) {
                break;
            }

            const fetched = await fetchPages(
                projectId,
                next.batch,
                site.llmsLinks,
            );

            pages.push(...fetched);
            seen.push(...next.batch);

            candidates = [
                ...next.candidates,
                ...fetched.flatMap((page) => page.links),
            ];
        }

        await saveLocales(projectId, site.origin, pages);

        const chunks = await planChunks(projectId);

        const facts = await Promise.all(
            chunks.map((urls) => extractFacts(projectId, runId, urls)),
        );

        const siteName = await nameSite(projectId, domain, site.home, facts);

        await Promise.all(
            productSkillNames.map((name) =>
                writeProductSkill(projectId, runId, siteName, name, facts),
            ),
        );

        await createStarterKinds(
            projectId,
            seen,
            pages.find((page) => page.author)?.author ?? null,
        );

        await finishRun(runId);
    } catch (error) {
        await failRun(
            runId,
            error instanceof Error ? error.message : String(error),
        );
    }
}

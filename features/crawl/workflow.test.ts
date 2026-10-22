import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pageCap } from '@/features/crawl/rank';
import * as steps from '@/features/crawl/steps';
import { crawlSite } from '@/features/crawl/workflow';
import * as runSteps from '@/features/runs/steps';
import { productSkillNames } from '@/features/skills/product-skill';

vi.mock('@/features/crawl/steps', () => {
    return {
        batchSize: 5,
        loadProject: vi.fn(async () => ({ domain: 'acme.com' })),
        clearCrawl: vi.fn(async () => {}),
        discoverPages: vi.fn(),
        nextBatch: vi.fn(),
        fetchPages: vi.fn(),
        saveLocales: vi.fn(async () => {}),
        planChunks: vi.fn(),
        extractFacts: vi.fn(),
        nameSite: vi.fn(async () => 'Acme'),
        fillOrganization: vi.fn(async () => {}),
        writeProductSkill: vi.fn(async () => 'skill'),
        createStarterKinds: vi.fn(async () => {}),
    };
});

vi.mock('@/features/runs/steps', () => {
    return {
        finishRun: vi.fn(async () => {}),
        failRun: vi.fn(async () => {}),
    };
});

const mocked = vi.mocked(steps);
const runs = vi.mocked(runSteps);

const site = {
    origin: 'https://acme.com',
    home: 'https://acme.com/',
    navLinks: [],
    localePrefixes: [],
    llmsLinks: [],
    robotsText: '',
};

function url(i: number) {
    return `https://acme.com/p${i}`;
}

beforeEach(() => {
    vi.clearAllMocks();

    mocked.discoverPages.mockResolvedValue({
        ...site,
        candidates: [url(1), url(2)],
    });

    mocked.nextBatch.mockImplementation(
        async (_run, _site, seen, candidates) => {
            const unseen = candidates.filter(
                (candidate) => !seen.includes(candidate),
            );

            const count = Math.min(steps.batchSize, pageCap - seen.length);

            return {
                batch: unseen.slice(0, count),
                candidates: unseen.slice(count),
            };
        },
    );

    mocked.fetchPages.mockImplementation(async (_project, _run, urls) =>
        urls.map((page) => ({
            url: page,
            lang: 'en',
            alternates: [],
            author: page === url(2) ? 'Jane' : null,
            links: page === url(1) ? [url(3)] : [],
        })),
    );

    mocked.planChunks.mockResolvedValue([[url(1)], [url(2), url(3)]]);

    mocked.extractFacts.mockImplementation(async (_project, _run, urls) => ({
        site_name: urls[0],
        identity: [],
        offering: [],
        audience: [],
        commercial: [],
        proof: [],
        positioning: [],
        voice: [],
        not_promised: [],
        questions: [],
        content: [],
        glossary: [],
        competitors: [],
        other: [],
    }));
});

describe('crawlSite', () => {
    it('reads the ranked batches, follows the links it finds, extracts every chunk, writes every product skill and finishes the run', async () => {
        await crawlSite('project', 'run');

        expect(mocked.fetchPages.mock.calls.map(([, , urls]) => urls)).toEqual([
            [url(1), url(2)],
            [url(3)],
        ]);

        expect(mocked.extractFacts).toHaveBeenCalledTimes(2);

        expect(mocked.nameSite).toHaveBeenCalledWith(
            'project',
            'run',
            'acme.com',
            'https://acme.com/',
            expect.arrayContaining([
                expect.objectContaining({ site_name: url(1) }),
                expect.objectContaining({ site_name: url(2) }),
            ]),
        );

        expect(mocked.fillOrganization).toHaveBeenCalledWith(
            'project',
            'run',
            'https://acme.com/',
        );

        expect(
            mocked.writeProductSkill.mock.calls.map(
                ([project, run, siteName, name]) => [
                    project,
                    run,
                    siteName,
                    name,
                ],
            ),
        ).toEqual(
            productSkillNames.map((name) => ['project', 'run', 'Acme', name]),
        );

        expect(mocked.createStarterKinds).toHaveBeenCalledWith(
            'project',
            'run',
            [url(1), url(2), url(3)],
            'Jane',
        );

        expect(runs.finishRun).toHaveBeenCalledWith('run');
        expect(runs.failRun).not.toHaveBeenCalled();
    });

    it('stops at the page cap', async () => {
        mocked.discoverPages.mockResolvedValue({
            ...site,
            candidates: Array.from({ length: pageCap + 20 }, (_, i) => url(i)),
        });

        await crawlSite('project', 'run');

        const fetched = mocked.fetchPages.mock.calls.flatMap(
            ([, , urls]) => urls,
        );

        expect(fetched).toHaveLength(pageCap);
    });

    it('marks the run failed with the message when a step throws', async () => {
        mocked.discoverPages.mockRejectedValue(
            new Error('The site did not answer at https://acme.com.'),
        );

        await crawlSite('project', 'run');

        expect(runs.failRun).toHaveBeenCalledWith(
            'run',
            'The site did not answer at https://acme.com.',
        );

        expect(runs.finishRun).not.toHaveBeenCalled();
    });
});

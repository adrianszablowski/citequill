import { describe, expect, it } from 'vitest';

import { readerHeading } from '@/features/crawl/budget';
import {
    type Facts,
    factGroups,
    factsForSkill,
    factsSystemPrompt,
    mergeFacts,
    productSkillBriefs,
    voiceRegisters,
} from '@/features/crawl/prompts';
import { productSkillNames } from '@/features/skills/product-skill';

function facts(siteName: string, group: Partial<Facts> = {}): Facts {
    return {
        site_name: siteName,
        ...Object.fromEntries(factGroups.map((key) => [key, []])),
        ...group,
    } as Facts;
}

describe('mergeFacts', () => {
    it('joins every group across chunks and drops repeated facts', () => {
        const merged = mergeFacts([
            facts('', {
                commercial: [
                    {
                        fact: 'Starter costs $29 a month.',
                        source_url: 'https://acme.com/pricing',
                    },
                ],
            }),
            facts('Acme', {
                commercial: [
                    {
                        fact: 'starter costs $29 a month.',
                        source_url: 'https://acme.com/',
                    },
                    {
                        fact: 'Pro costs $79 a month.',
                        source_url: 'https://acme.com/pricing',
                    },
                ],
                proof: [
                    {
                        fact: 'Used by 2,000 teams.',
                        source_url: 'https://acme.com/',
                    },
                ],
            }),
        ]);

        expect(merged.site_name).toBe('Acme');

        expect(merged.commercial.map((entry) => entry.fact)).toEqual([
            'Starter costs $29 a month.',
            'Pro costs $79 a month.',
        ]);

        expect(merged.proof).toHaveLength(1);
        expect(merged.identity).toEqual([]);
    });

    it('keeps the same voice trait under two registers and drops its repeat within one', () => {
        const merged = mergeFacts([
            facts('', {
                voice: [
                    {
                        register: 'landing',
                        fact: 'Uses contractions.',
                        source_url: 'https://acme.com/',
                    },
                    {
                        register: 'blog',
                        fact: 'Uses contractions.',
                        source_url: 'https://acme.com/blog/one',
                    },
                ],
            }),
            facts('', {
                voice: [
                    {
                        register: 'landing',
                        fact: 'Uses contractions.',
                        source_url: 'https://acme.com/pl',
                    },
                ],
            }),
        ]);

        expect(merged.voice.map((entry) => entry.register)).toEqual([
            'landing',
            'blog',
        ]);
    });

    it('is empty for no chunks', () => {
        expect(mergeFacts([])).toEqual(facts(''));
    });

    it('drops a fact that describes the chunk and keeps one about the site', () => {
        const merged = mergeFacts([
            facts('Acme', {
                content: [
                    {
                        fact: 'No author bylines appear on these pages.',
                        source_url: 'https://acme.com/blog',
                    },
                    {
                        fact: 'Prices are missing from the pages shown.',
                        source_url: 'https://acme.com/',
                    },
                    {
                        fact: 'None of this chunk names a founder.',
                        source_url: 'https://acme.com/about',
                    },
                    {
                        fact: 'The blog posts are signed by Priya Shah, head coach.',
                        source_url: 'https://acme.com/blog',
                    },
                ],
                not_promised: [
                    {
                        fact: 'The app has no plate calculator.',
                        source_url: 'https://acme.com/faq',
                    },
                ],
                commercial: [
                    {
                        fact: 'The pricing page lists three plans.',
                        source_url: 'https://acme.com/pricing',
                    },
                ],
            }),
        ]);

        expect(merged.content.map((entry) => entry.fact)).toEqual([
            'The blog posts are signed by Priya Shah, head coach.',
        ]);

        expect(merged.not_promised).toHaveLength(1);
        expect(merged.commercial).toHaveLength(1);
    });
});

describe('factsSystemPrompt', () => {
    it('names every voice register and the heading of the text readers see', () => {
        for (const register of voiceRegisters) {
            expect(factsSystemPrompt).toContain(register);
        }

        expect(factsSystemPrompt).toContain(readerHeading);
    });
});

describe('factsForSkill', () => {
    it('keeps the facts of the groups the skill reads, without their URLs', () => {
        const all = facts('Acme', {
            commercial: [
                {
                    fact: 'Starter costs $29 a month.',
                    source_url: 'https://acme.com/pricing',
                },
            ],
            proof: [
                {
                    fact: 'Used by 2,000 teams.',
                    source_url: 'https://acme.com/',
                },
            ],
        });

        expect(factsForSkill(all, 'Plans and prices')).toEqual([
            'Starter costs $29 a month.',
        ]);

        expect(factsForSkill(all, 'Proof')).toEqual(['Used by 2,000 teams.']);
        expect(factsForSkill(all, 'Competitors')).toEqual([]);
    });

    it('starts every voice fact with its register, so How we speak can section by it', () => {
        const all = facts('Acme', {
            voice: [
                {
                    register: 'landing',
                    fact: '"You lift. Trackist does the math."',
                    source_url: 'https://acme.com/',
                },
                {
                    register: 'shared',
                    fact: 'The product is always "Trackist", never "the app".',
                    source_url: 'https://acme.com/',
                },
            ],
            glossary: [
                {
                    fact: 'A "block" is four weeks of training.',
                    source_url: 'https://acme.com/blog/blocks',
                },
            ],
        });

        expect(factsForSkill(all, 'How we speak')).toEqual([
            'landing: "You lift. Trackist does the math."',
            'shared: The product is always "Trackist", never "the app".',
            'A "block" is four weeks of training.',
        ]);
    });

    it('gives every fact group to at least one product skill, and every skill but Languages reads facts', () => {
        const briefed = Object.keys(productSkillBriefs);

        expect(briefed.sort()).toEqual(
            productSkillNames.filter((name) => name !== 'Languages').sort(),
        );

        const read = new Set(
            Object.values(productSkillBriefs).flatMap((brief) => brief.groups),
        );

        expect([...read].sort()).toEqual([...factGroups].sort());
    });
});

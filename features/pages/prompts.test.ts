import { describe, expect, it } from 'vitest';

import {
    briefSystemPrompt,
    findingsFrom,
    skillsForBrief,
    skillsForCheck,
    skillsForWriting,
    type WriteContext,
    writeSystemPrompt,
} from '@/features/pages/prompts';
import { productSkillNames } from '@/features/skills/product-skill';

const productSkills = productSkillNames.map((name) => ({
    name,
    description: `About ${name.toLowerCase()}.`,
    body: `Body of ${name}.`,
}));

const context: WriteContext = {
    siteName: 'Acme',
    origin: 'https://acme.com',
    locale: 'en',
    languageName: 'English',
    topic: 'How to deload',
    kind: {
        name: 'Blog',
        skill: { name: 'Blog', description: 'A post.', body: 'Blog rules.' },
    },
    customSkills: [
        { name: 'Glossary', description: 'Terms.', body: 'Glossary body.' },
    ],
    productSkills,
    sitePages: [{ url: 'https://acme.com/pricing', title: 'Pricing' }],
};

describe('skills for each call', () => {
    it('gives the brief the kind, custom and three always skills in full and the other seven to pick', () => {
        const { full, pickable } = skillsForBrief(context);

        expect(full.map((skill) => skill.name)).toEqual([
            'Blog',
            'Glossary',
            'What it is',
            'How we speak',
            'What we do not claim',
        ]);

        expect(pickable.map((skill) => skill.name)).toEqual(
            productSkillNames.filter(
                (name) =>
                    ![
                        'What it is',
                        'How we speak',
                        'What we do not claim',
                    ].includes(name),
            ),
        );
    });

    it('gives the writer the base skills plus the ones the brief picked, whatever their case', () => {
        const names = skillsForWriting(context, [
            'plans and prices',
            'What it is',
            'Unknown',
        ]).map((skill) => skill.name);

        expect(names).toEqual([
            'Blog',
            'Glossary',
            'What it is',
            'How we speak',
            'What we do not claim',
            'Plans and prices',
        ]);
    });

    it('gives the check all ten product skills', () => {
        expect(skillsForCheck(context)).toHaveLength(10);
    });
});

describe('prompts', () => {
    it('lists the pickable skills by description and the site pages in the brief prompt', () => {
        const prompt = briefSystemPrompt(context);

        expect(prompt).toContain('- Proof: About proof.');
        expect(prompt).not.toContain('- What it is: About what it is.');
        expect(prompt).toContain('Body of What it is.');
        expect(prompt).toContain('- https://acme.com/pricing: Pricing');
    });

    it('puts only the picked skills into the writing prompt', () => {
        const prompt = writeSystemPrompt(context, {
            intent: '',
            answer: '',
            outline: [],
            skills: ['Proof'],
            sources: [],
            internal_links: [],
            length_words: 1200,
        });

        expect(prompt).toContain('Body of Proof.');
        expect(prompt).not.toContain('Body of Competitors.');
        expect(prompt).toContain('in English');
    });
});

describe('findingsFrom', () => {
    it('turns unconfirmed claims, self references and link findings into one list', () => {
        const findings = findingsFrom(
            {
                claims: [
                    { claim: 'Acme has 10 plans.', confirmed_by: null },
                    { claim: 'Acme costs $5.', confirmed_by: 'Pro is $5.' },
                    { claim: 'Acme is new.', confirmed_by: ' ' },
                ],
                self_references: ['As an AI I think.'],
            },
            ['The link to /x is not among the pages Citequill knows.'],
        );

        expect(findings).toEqual([
            'Not in the skills: "Acme has 10 plans."',
            'Not in the skills: "Acme is new."',
            'Speaks of itself: "As an AI I think."',
            'The link to /x is not among the pages Citequill knows.',
        ]);
    });

    it('is empty for a clean page', () => {
        expect(findingsFrom({ claims: [], self_references: [] }, [])).toEqual(
            [],
        );
    });
});

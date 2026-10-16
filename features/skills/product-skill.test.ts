import { describe, expect, it } from 'vitest';

import {
    productSkillNames,
    sortProductSkills,
} from '@/features/skills/product-skill';

describe('sortProductSkills', () => {
    it('puts the product skills in their fixed order, whatever their case', () => {
        const sorted = sortProductSkills([
            { name: 'Competitors' },
            { name: 'what it does' },
            { name: 'What it is' },
        ]);

        expect(sorted.map((skill) => skill.name)).toEqual([
            'What it is',
            'what it does',
            'Competitors',
        ]);
    });

    it('keeps other skills after the product skills, in the order given', () => {
        const sorted = sortProductSkills([
            { name: 'Guide' },
            { name: 'Blog' },
            { name: productSkillNames[9] },
        ]);

        expect(sorted.map((skill) => skill.name)).toEqual([
            'Competitors',
            'Guide',
            'Blog',
        ]);
    });
});

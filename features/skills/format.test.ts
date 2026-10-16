import { describe, expect, it } from 'vitest';

import { renderSkill } from '@/features/skills/format';

describe('renderSkill', () => {
    it('puts the name and description in frontmatter above the body', () => {
        expect(
            renderSkill({
                name: 'product',
                description: 'What Acme is.',
                body: '\n# Acme\n\nText.\n\n',
            }),
        ).toBe(
            '---\nname: product\ndescription: What Acme is.\n---\n\n# Acme\n\nText.\n',
        );
    });
});

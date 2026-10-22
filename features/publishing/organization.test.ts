import { describe, expect, it } from 'vitest';

import { organizationDefaults } from '@/features/publishing/organization';

describe('organizationDefaults', () => {
    it("is the project's name and the origin of the main locale's base URL", () => {
        expect(
            organizationDefaults('Acme', [
                {
                    base_url: 'https://acme.com/pl',
                    is_default: false,
                },
                { base_url: 'https://www.acme.com/en', is_default: true },
            ]),
        ).toEqual({ name: 'Acme', url: 'https://www.acme.com' });
    });

    it('has no URL while the project has no locale', () => {
        expect(organizationDefaults('acme.com', [])).toEqual({
            name: 'acme.com',
            url: null,
        });
    });
});

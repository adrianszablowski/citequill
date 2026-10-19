import { describe, expect, it } from 'vitest';

import { schemaOrgTypes, schemaOrgVersion } from '@/features/audit/schema-org';

describe('schemaOrgTypes', () => {
    it('holds every class of schema.org 30.1, pending and superseded ones included, and no class of another vocabulary', () => {
        expect(schemaOrgVersion).toBe('30.1');
        expect(Object.keys(schemaOrgTypes)).toHaveLength(939);

        expect(
            Object.keys(schemaOrgTypes).filter((type) => type.includes(':')),
        ).toEqual([]);

        expect(schemaOrgTypes).toHaveProperty('AmpStory');
        expect(schemaOrgTypes).toHaveProperty('ProductReturnPolicy');
    });

    it('maps a type to its parents, every one of them, and a data type to none', () => {
        expect(schemaOrgTypes.Restaurant).toEqual(['FoodEstablishment']);
        expect(schemaOrgTypes.LocalBusiness).toEqual(['Organization', 'Place']);
        expect(schemaOrgTypes.Text).toEqual([]);
        expect(schemaOrgTypes.Thing).toEqual([]);
    });

    it('keeps only the parents schema.org defines, so a class another vocabulary also places keeps its schema.org parents', () => {
        expect(schemaOrgTypes.Error).toEqual(['InstantaneousEvent']);
        expect(schemaOrgTypes.DataType).toEqual([]);
        expect(schemaOrgTypes.Brand).toEqual(['Intangible']);

        expect(
            Object.values(schemaOrgTypes)
                .flat()
                .filter((parent) => parent.includes(':')),
        ).toEqual([]);
    });
});

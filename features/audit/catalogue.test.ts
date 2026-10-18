import { describe, expect, it } from 'vitest';

import {
    areaWeights,
    catalogue,
    checkOf,
    scoredChecks,
} from '@/features/audit/catalogue';

describe('catalogue', () => {
    it('scores 116 checks, as the score header counts them', () => {
        expect(scoredChecks).toHaveLength(116);
    });

    it('gates the score on the nine checks the Severity section names, every one of severity 3', () => {
        const gates = catalogue.filter((check) => check.isGate);

        expect(gates.map((check) => check.id).sort()).toEqual(
            [
                'robots-googlebot-blocked',
                'noindex-site',
                'soft-404',
                'page-5xx',
                'redirect-loop',
                'redirect-chain-long',
                'spam-pattern',
                'https-missing',
                'mixed-active',
            ].sort(),
        );

        expect(gates.every((check) => check.severity === '3')).toBe(true);
    });

    it('names each check once', () => {
        const ids = catalogue.map((check) => check.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it('holds the 57 rows of the On-page table, hints included', () => {
        expect(
            catalogue.filter((check) => check.area === 'on-page'),
        ).toHaveLength(57);

        expect(checkOf('title-rendered-only')).toMatchObject({
            severity: 'hint',
            needs: 'rendered',
        });

        expect(checkOf('structured-data-format').needs).toBe('slice-6');
        expect(checkOf('og-missing').needs).toBe('raw');
    });

    it('weighs the seven areas to 100', () => {
        expect(
            Object.values(areaWeights).reduce<number>(
                (sum, weight) => sum + weight,
                0,
            ),
        ).toBe(100);
    });

    it('keeps what a check needs beside its severity', () => {
        expect(checkOf('noindex-rendered-only')).toMatchObject({
            area: 'indexability',
            severity: '2',
            needs: 'rendered',
            isGate: false,
        });

        expect(checkOf('mobile-content-differs').needs).toBe('sample');
        expect(checkOf('jsonld-mismatch').needs).toBe('slice-6');

        expect(checkOf('page-5xx')).toMatchObject({
            isGate: true,
            needs: 'raw',
        });

        expect(checkOf('noindex-content').severity).toBe('question');
    });
});

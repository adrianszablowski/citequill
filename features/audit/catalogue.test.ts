import { describe, expect, it } from 'vitest';

import {
    areaWeights,
    catalogue,
    checkOf,
    scoredChecks,
} from '@/features/audit/catalogue';

describe('catalogue', () => {
    it('scores 113 checks, as the score header counts them', () => {
        expect(scoredChecks).toHaveLength(113);
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

    it('holds the 56 rows of the On-page table, hints included', () => {
        expect(
            catalogue.filter((check) => check.area === 'on-page'),
        ).toHaveLength(56);

        expect(checkOf('title-rendered-only')).toMatchObject({
            severity: 'hint',
            needs: 'rendered',
        });

        expect(checkOf('structured-data-format').needs).toBe('raw');
        expect(checkOf('og-missing').needs).toBe('raw');
    });

    it('holds the 17 rows of the Links table, hints included', () => {
        expect(
            catalogue.filter((check) => check.area === 'links'),
        ).toHaveLength(17);

        expect(checkOf('link-external-refused').severity).toBe('hint');
        expect(checkOf('link-rendered-only').needs).toBe('rendered');
    });

    it('holds the 9 rows of the HTTPS table, hints included', () => {
        expect(
            catalogue.filter((check) => check.area === 'https'),
        ).toHaveLength(9);

        expect(checkOf('protocol-relative').severity).toBe('hint');
        expect(checkOf('security-headers').severity).toBe('hint');
        expect(checkOf('mixed-active').isGate).toBe(true);
    });

    it('holds the 5 rows of the Mobile table, hints included', () => {
        expect(
            catalogue.filter((check) => check.area === 'mobile'),
        ).toHaveLength(5);

        expect(checkOf('mobile-layout')).toMatchObject({
            severity: 'hint',
            needs: 'rendered',
        });
    });

    it('holds the 5 rows of the Performance table, hints included', () => {
        expect(
            catalogue.filter((check) => check.area === 'performance'),
        ).toHaveLength(5);

        for (const id of [
            'assets-uncached',
            'assets-heavy',
            'dom-size',
        ] as const) {
            expect(checkOf(id).severity, id).toBe('hint');
        }

        expect(checkOf('html-slow').severity).toBe('2');
        expect(checkOf('html-uncompressed').severity).toBe('2');
    });

    it('holds the 179 rows of the tables of the document', () => {
        expect(catalogue).toHaveLength(179);
    });

    it('holds the 71 rows of the Indexability table, hints and questions included', () => {
        expect(
            catalogue.filter((check) => check.area === 'indexability'),
        ).toHaveLength(71);
    });

    it('holds the three GEO hints in AI access, before markdown-alternate', () => {
        const ids = catalogue
            .filter((check) => check.area === 'ai-access')
            .map((check) => check.id);

        expect(ids.slice(-4)).toEqual([
            'geo-qa-structure',
            'geo-source-links',
            'geo-slug',
            'markdown-alternate',
        ]);

        for (const id of [
            'geo-qa-structure',
            'geo-source-links',
            'geo-slug',
        ] as const) {
            expect(checkOf(id)).toMatchObject({
                severity: 'hint',
                needs: 'raw',
                isGate: false,
            });
        }
    });

    it('holds the 16 rows of the AI access table and its GEO hints, the robots.txt hints, pay-per-crawl and markdown-alternate included', () => {
        expect(
            catalogue.filter((check) => check.area === 'ai-access'),
        ).toHaveLength(16);

        for (const id of [
            'ai-training-bots-blocked',
            'ai-user-agents-blocked',
            'content-signals',
            'pay-per-crawl',
            'markdown-alternate',
            'answer-first',
            'one-topic',
        ] as const) {
            expect(checkOf(id).severity, id).toBe('hint');
        }

        expect(checkOf('ai-search-bots-blocked').severity).toBe('2');
        expect(checkOf('ai-cdn-blocked').severity).toBe('2');
        expect(checkOf('nocache').severity).toBe('1');
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

        expect(checkOf('jsonld-mismatch')).toMatchObject({
            severity: '2',
            needs: 'raw',
        });

        expect(checkOf('page-5xx')).toMatchObject({
            isGate: true,
            needs: 'raw',
        });

        expect(checkOf('noindex-content').severity).toBe('question');
    });
});

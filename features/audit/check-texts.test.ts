import { describe, expect, it } from 'vitest';

import { catalogue, checkOf } from '@/features/audit/catalogue';
import { checkText, notCounted, notScored } from '@/features/audit/check-texts';
import { shippedChecks } from '@/features/audit/score';

const hosts = new Set([
    'developers.google.com',
    'www.sitemaps.org',
    'www.bing.com',
    'developers.cloudflare.com',
    'developers.openai.com',
]);

describe('checkText', () => {
    it('explains every shipped check with a name, what Google says, a link and how to fix it', () => {
        for (const id of shippedChecks) {
            const text = checkText(id);

            expect(text, id).not.toBeNull();
            expect(text!.name, id).not.toBe('');
            expect(text!.says, id).toMatch(/\.$/);
            expect(text!.fix, id).toMatch(/[.?]$/);

            const link = new URL(text!.link);

            expect(link.protocol, id).toBe('https:');
            expect(hosts.has(link.host), id).toBe(true);
        }
    });

    it('gives no texts to a check that has not shipped', () => {
        const unshipped = catalogue.filter(
            (check) => !shippedChecks.includes(check.id),
        );

        expect(unshipped.length).toBeGreaterThan(0);

        for (const check of unshipped) {
            expect(checkText(check.id), check.id).toBeNull();
        }
    });

    it('tells the owner a hint is not counted, in AI access without naming Google, and asks a question as a question', () => {
        for (const id of shippedChecks) {
            const { area, severity } = checkOf(id);
            const text = checkText(id)!;
            const isAiAccess = area === 'ai-access';

            expect(text.says.endsWith(notCounted), id).toBe(
                severity === 'hint' && !isAiAccess,
            );

            expect(text.says.endsWith(notScored), id).toBe(
                severity === 'hint' && isAiAccess,
            );

            if (severity === 'question') {
                expect(text.fix, id).toContain('?');
            }
        }
    });
});

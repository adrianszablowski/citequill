import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
    referencePage,
    scalarBundle,
    scalarIntegrity,
} from '@/features/content-api/reference';
import { apiUrl } from '@/features/content-api/urls';

async function page() {
    const answer = await referencePage();

    return {
        html: await answer.text(),
        policy: Object.fromEntries(
            (answer.headers.get('Content-Security-Policy') ?? '')
                .split('; ')
                .map((directive) => {
                    const [name, ...sources] = directive.split(' ');

                    return [name, sources];
                }),
        ),
    };
}

describe('referencePage', () => {
    it('loads one pinned version of the bundle and allows no other script', async () => {
        const { html, policy } = await page();

        expect(scalarBundle).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+\//);

        expect(html).toContain(
            `<script src="${scalarBundle}" integrity="${scalarIntegrity}" crossorigin="anonymous"></script>`,
        );

        expect(scalarIntegrity).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
        expect(policy['script-src'][0]).toBe(scalarBundle);
        expect(policy['script-src']).not.toContain("'unsafe-inline'");
        expect(policy['default-src']).toEqual(["'none'"]);
    });

    it('allows the inline start of the reference by its hash', async () => {
        const { html, policy } = await page();

        const inline = [
            ...html.matchAll(
                /<script type="text\/javascript">([\s\S]*?)<\/script>/g,
            ),
        ].map(([, script]) => script);

        expect(inline).toHaveLength(1);
        expect(inline[0]).toContain('Scalar.createApiReference');

        expect(policy['script-src']).toContain(
            `'sha256-${createHash('sha256').update(inline[0]).digest('base64')}'`,
        );
    });

    it('fetches the OpenAPI document alone, and loads no font from Scalar', async () => {
        const { html, policy } = await page();

        expect(policy['connect-src']).toEqual([apiUrl('/openapi.json')]);
        expect(html).toContain(`"url": "${apiUrl('/openapi.json')}"`);
        expect(policy['font-src']).toEqual(["'self'"]);
        expect(html).toContain('"withDefaultFonts": false');
        expect(html).toContain('"telemetry": false');
        expect(html).toContain('"hideTestRequestButton": true');
    });
});

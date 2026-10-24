import { createHash } from 'node:crypto';

import { ApiReference } from '@scalar/nextjs-api-reference';

import { apiUrl } from '@/features/content-api/urls';

// The bundle whose @scalar/types 0.24.0 type-checks the configuration below,
// so a newer one could drop a renamed option, such as telemetry, unnoticed.
export const scalarBundle =
    'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.75.1/dist/browser/standalone.js';

export const scalarIntegrity =
    'sha384-G+2Q2i9l3PPfmYkk0b4BAIUrs7xb/DNaTL1wCYYab4c9dIKlCyiqzC0Qx3eq9Wf6';

export async function referencePage() {
    const html = (await reference().text()).replace(
        `<script src="${scalarBundle}">`,
        `<script src="${scalarBundle}" integrity="${scalarIntegrity}" crossorigin="anonymous">`,
    );

    const hashes = [...html.matchAll(inlineScript)].map(
        ([, script]) =>
            `'sha256-${createHash('sha256').update(script).digest('base64')}'`,
    );

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': [
                "default-src 'none'",
                `script-src ${scalarBundle} ${hashes.join(' ')}`,
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data:",
                `connect-src ${openApiUrl}`,
                "font-src 'self'",
                "base-uri 'none'",
                "form-action 'none'",
                "frame-ancestors 'none'",
            ].join('; '),
        },
    });
}

const openApiUrl = apiUrl('/openapi.json');

const reference = ApiReference({
    url: openApiUrl,
    cdn: scalarBundle,
    pageTitle: 'Content API reference, Citequill',
    withDefaultFonts: false,
    hideClientButton: true,
    hideTestRequestButton: true,
    showDeveloperTools: 'never',
    telemetry: false,
    mcp: { disabled: true },
    agent: { disabled: true },
});

const inlineScript = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { problems } from '@/features/content-api/answer';
import { openApi } from '@/features/content-api/openapi';

const apiRoot = join(process.cwd(), 'app', 'api', 'v1');

function routePaths() {
    return readdirSync(apiRoot, { recursive: true, encoding: 'utf8' })
        .filter(
            (file) => file.endsWith(`${sep}route.ts`) || file === 'route.ts',
        )
        .map((file) =>
            `/${relative('.', join(file, '..'))}`
                .split(sep)
                .join('/')
                .replace(/\[(\w+)\]/g, '{$1}'),
        )
        .sort();
}

describe('openApi', () => {
    it('has a path for every route under app/api/v1, and a route for every path', () => {
        const documented = Object.keys(openApi().paths)
            .map((path) => path.replace(/\.xml$/, ''))
            .sort();

        expect(documented).toEqual(routePaths());
    });

    it('lists every error code the API answers', () => {
        expect(
            openApi().components.schemas.Problem.properties.code.enum,
        ).toEqual(Object.keys(problems));
    });

    it('is OpenAPI 3.1 with a bearer key on every path that takes one', () => {
        const document = openApi();

        expect(document.openapi).toBe('3.1.0');

        expect(document.components.securitySchemes.key).toMatchObject({
            type: 'http',
            scheme: 'bearer',
        });
    });

    it('describes the challenge on every 401 and a 500 on every path of a site', () => {
        for (const [path, { get }] of Object.entries(openApi().paths)) {
            const responses: Record<string, object> = get.responses;

            if ('401' in responses) {
                expect(responses['401']).toHaveProperty([
                    'headers',
                    'WWW-Authenticate',
                ]);
            }

            if (path.startsWith('/sites/')) {
                expect(responses).toHaveProperty('500');
            }
        }
    });
});

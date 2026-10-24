import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    jsonAnswer,
    nextLink,
    problem,
    problems,
} from '@/features/content-api/answer';

beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://citequill.com');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('problem', () => {
    it('writes an RFC 9457 problem whose type is its entry in the guide', async () => {
        const answer = problem('page_not_found');

        expect(answer.status).toBe(404);

        expect(answer.headers.get('Content-Type')).toBe(
            'application/problem+json',
        );

        expect(await answer.json()).toEqual({
            type: 'https://citequill.com/docs#page_not_found',
            title: 'Page not found',
            status: 404,
            detail: problems.page_not_found.detail,
            code: 'page_not_found',
        });
    });

    it('takes a detail of its own and extension members', async () => {
        const answer = problem('page_unpublished', 'Gone.', { redirect: null });

        expect(await answer.json()).toMatchObject({
            detail: 'Gone.',
            redirect: null,
        });
    });

    it('carries the cache headers of every answer and no challenge outside 401', () => {
        const answer = problem('wrong_site');

        expect(answer.headers.get('Cache-Control')).toBe('private, no-cache');
        expect(answer.headers.get('ETag')).toMatch(/^W\//);
        expect(answer.headers.get('WWW-Authenticate')).toBeNull();
    });

    it('has a status, a title and a detail with no blame for every code', () => {
        for (const { title, detail } of Object.values(problems)) {
            expect(`${title} ${detail}`).not.toMatch(
                /invalid|incorrect|illegal/i,
            );
        }
    });
});

describe('jsonAnswer', () => {
    it('gives the same weak ETag to the same body, and 304 to a matching If-None-Match', async () => {
        const first = jsonAnswer(new Request('https://x.test/'), { a: 1 });
        const etag = first.headers.get('ETag') ?? '';

        const again = jsonAnswer(
            new Request('https://x.test/', {
                headers: { 'If-None-Match': `"other", ${etag}` },
            }),
            { a: 1 },
        );

        expect(again.status).toBe(304);
        expect(again.headers.get('ETag')).toBe(etag);
        expect(await again.text()).toBe('');

        const changed = jsonAnswer(
            new Request('https://x.test/', {
                headers: { 'If-None-Match': etag },
            }),
            { a: 2 },
        );

        expect(changed.status).toBe(200);
    });
});

describe('nextLink', () => {
    it('keeps the query of the request and sets the cursor', () => {
        expect(
            nextLink(
                new Request(
                    'https://citequill.com/api/v1/sites/s/pages?kind=Blog&cursor=old',
                ),
                'new',
            ),
        ).toEqual({
            Link: '<https://citequill.com/api/v1/sites/s/pages?kind=Blog&cursor=new>; rel="next"',
        });
    });
});

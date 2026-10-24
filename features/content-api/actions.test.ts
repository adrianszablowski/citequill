import { refresh } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSiteKey, deleteSiteKey } from '@/features/content-api/actions';
import { clearApiCache } from '@/features/content-api/cache';
import { isKey, keyHash, keyHint } from '@/features/content-api/key';
import { keyLimitSentence } from '@/features/content-api/schema';
import { fakeSupabase } from '@/lib/supabase/fake';
import { createClient } from '@/lib/supabase/server';

vi.mock('next/cache', () => {
    return { refresh: vi.fn() };
});

vi.mock('@/features/auth/queries', () => {
    return { getCurrentUser: vi.fn() };
});

vi.mock('@/lib/supabase/server', () => {
    return { createClient: vi.fn() };
});

vi.mock('@/features/content-api/cache', () => {
    return { clearApiCache: vi.fn() };
});

function database(answer: object = {}) {
    const fake = fakeSupabase(() => answer);

    vi.mocked(createClient).mockResolvedValue(fake.client as never);

    return fake;
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('createSiteKey', () => {
    it("stores the key's hash and hint in the session and gives the key back once", async () => {
        const fake = database();

        const result = await createSiteKey('project', { name: ' Production ' });

        if (!('key' in result) || !result.key) {
            throw new Error('No key came back.');
        }

        expect(isKey(result.key)).toBe(true);

        expect(fake.queries[0]).toEqual({
            name: 'site_keys',
            calls: [
                [
                    'insert',
                    {
                        project_id: 'project',
                        name: 'Production',
                        key_hash: keyHash(result.key),
                        key_hint: keyHint(result.key),
                    },
                ],
            ],
        });

        expect(JSON.stringify(fake.queries)).not.toContain(result.key);
        expect(refresh).toHaveBeenCalled();
    });

    it('refuses a key with no name and writes nothing', async () => {
        const fake = database();

        expect(await createSiteKey('project', { name: ' ' })).toEqual({
            error: 'Name the key, such as Production.',
        });

        expect(fake.writes()).toEqual([]);
    });

    it('refuses a name over 60 characters with the sentence that asks to shorten it', async () => {
        const fake = database();

        expect(
            await createSiteKey('project', { name: 'a'.repeat(61) }),
        ).toEqual({ error: 'Shorten the name to 60 characters or fewer.' });

        expect(fake.writes()).toEqual([]);
    });

    it("turns the database's refusal of an 11th key into the sentence of the button", async () => {
        database({ error: { message: 'The project has 10 keys.' } });

        expect(await createSiteKey('project', { name: 'Preview' })).toEqual({
            error: keyLimitSentence,
        });
    });
});

describe('deleteSiteKey', () => {
    it("deletes the project's key and clears the project's Content API cache", async () => {
        const fake = database({ data: [{ id: 'key' }] });

        expect(await deleteSiteKey('project', 'key')).toEqual({});

        expect(fake.queries[0].calls).toEqual([
            ['delete'],
            ['eq', 'project_id', 'project'],
            ['eq', 'id', 'key'],
            ['select', 'id'],
        ]);

        expect(clearApiCache).toHaveBeenCalledWith('project');
    });

    it('says the key is gone and clears nothing when the project has no such key', async () => {
        database({ data: [] });

        expect(await deleteSiteKey('project', 'key')).toEqual({
            error: 'The key is gone from this project.',
        });

        expect(clearApiCache).not.toHaveBeenCalled();
    });
});

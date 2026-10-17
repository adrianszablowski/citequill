import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isOperator } from '@/features/auth/queries';
import { createClient } from '@/lib/supabase/server';

vi.mock('server-only', () => {
    return {};
});

vi.mock('next/navigation', () => {
    return {
        redirect: vi.fn(() => {
            throw new Error('NEXT_REDIRECT');
        }),
    };
});

vi.mock('@/lib/supabase/server', () => {
    return { createClient: vi.fn() };
});

function signedIn(email: string) {
    vi.mocked(createClient).mockResolvedValue({
        auth: {
            getClaims: async () => ({
                data: { claims: { sub: 'user', email } },
            }),
        },
    } as never);
}

beforeEach(() => {
    vi.stubEnv('ALLOWED_EMAILS', 'owner@acme.com,guest@acme.com');
});

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('isOperator', () => {
    it('makes nobody the operator when the list is empty or unset', async () => {
        signedIn('owner@acme.com');

        vi.stubEnv('OPERATOR_EMAILS', '');
        expect(await isOperator()).toBe(false);

        vi.stubEnv('OPERATOR_EMAILS', undefined);
        expect(await isOperator()).toBe(false);
    });

    it('makes the one address on the list the operator', async () => {
        vi.stubEnv('OPERATOR_EMAILS', 'owner@acme.com');
        signedIn('owner@acme.com');

        expect(await isOperator()).toBe(true);
    });

    it('folds case and spaces on both sides', async () => {
        vi.stubEnv('OPERATOR_EMAILS', 'other@acme.com , Owner@Acme.com ');
        signedIn(' OWNER@acme.com');

        expect(await isOperator()).toBe(true);
    });

    it('keeps a signed-in user off the list from being the operator', async () => {
        vi.stubEnv('OPERATOR_EMAILS', 'owner@acme.com');
        signedIn('guest@acme.com');

        expect(await isOperator()).toBe(false);
    });
});

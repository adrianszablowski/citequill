import { describe, expect, it } from 'vitest';

import { isPublicPath } from '@/lib/supabase/proxy';

describe('isPublicPath', () => {
    it('lets the home page and the bot page through', () => {
        expect(isPublicPath('/')).toBe(true);
        expect(isPublicPath('/bot')).toBe(true);
    });

    it('lets the sign-in paths through with what follows them', () => {
        expect(isPublicPath('/login')).toBe(true);
        expect(isPublicPath('/auth/callback')).toBe(true);
    });

    it('sends a path that only starts with /bot to sign in', () => {
        expect(isPublicPath('/bots')).toBe(false);
        expect(isPublicPath('/bot/secret')).toBe(false);
    });

    it('lets the documentation through, its reference included', () => {
        expect(isPublicPath('/docs')).toBe(true);
        expect(isPublicPath('/docs/reference')).toBe(true);
        expect(isPublicPath('/docsx')).toBe(false);
    });

    it('sends the dashboard to sign in', () => {
        expect(isPublicPath('/projects')).toBe(false);
    });
});

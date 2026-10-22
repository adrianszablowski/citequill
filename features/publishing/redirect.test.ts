import { describe, expect, it } from 'vitest';

import { isRedirectTarget, redirectUrl } from '@/features/publishing/redirect';
import { unpublishSchema } from '@/features/publishing/schema';

const pageUrl = 'https://acme.com/pl/blog/deload';

describe('isRedirectTarget', () => {
    it('takes a path on the site and a full https address', () => {
        expect(isRedirectTarget('/pricing')).toBe(true);
        expect(isRedirectTarget('/')).toBe(true);
        expect(isRedirectTarget('https://other.com/new')).toBe(true);
    });

    it('refuses an address that leaves the site as a path, plain http and words', () => {
        expect(isRedirectTarget('//evil.com/x')).toBe(false);
        expect(isRedirectTarget('/\\evil.com')).toBe(false);
        expect(isRedirectTarget('/a path')).toBe(false);
        expect(isRedirectTarget('http://other.com/new')).toBe(false);
        expect(isRedirectTarget('pricing')).toBe(false);
        expect(isRedirectTarget('javascript:alert(1)')).toBe(false);
    });

    it("refuses an address with a user name, which reads like the site's own", () => {
        expect(isRedirectTarget('https://acme.com@evil.com/x')).toBe(false);
        expect(isRedirectTarget('https://user:secret@acme.com/x')).toBe(false);
    });
});

describe('redirectUrl', () => {
    it("stores a path as an absolute URL on the page's own host", () => {
        expect(redirectUrl('/pricing?plan=pro', pageUrl)).toBe(
            'https://acme.com/pricing?plan=pro',
        );
    });

    it('keeps a full address as it is', () => {
        expect(redirectUrl('https://other.com/new', pageUrl)).toBe(
            'https://other.com/new',
        );
    });

    it('stores an address with no slashes after the scheme as the check read it', () => {
        expect(isRedirectTarget('https:evil.com')).toBe(true);

        expect(redirectUrl('https:evil.com', pageUrl)).toBe(
            'https://evil.com/',
        );

        expect(redirectUrl('https:/evil.com', pageUrl)).toBe(
            'https://evil.com/',
        );
    });
});

describe('unpublishSchema', () => {
    it('needs no address for a page that answers 410', () => {
        expect(
            unpublishSchema.safeParse({ answer: 'gone', to: '' }).success,
        ).toBe(true);
    });

    it('asks for an address for a redirect, and for one the site can send visitors to', () => {
        const empty = unpublishSchema.safeParse({ answer: 'redirect', to: '' });

        const loose = unpublishSchema.safeParse({
            answer: 'redirect',
            to: 'x',
        });

        expect(empty.error?.issues[0]).toMatchObject({
            path: ['to'],
            message: 'Give the address to send visitors to.',
        });

        expect(loose.error?.issues[0].path).toEqual(['to']);
    });
});

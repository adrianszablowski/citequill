import { describe, expect, it } from 'vitest';

import {
    judgeMobile,
    missingLinkShare,
    phoneWordShare,
    viewportChecks,
} from '@/features/audit/mobile-checks';
import type { Fetched, Hop } from '@/features/crawl/fetch';

const url = 'https://acme.com/pricing';
const hosts = ['acme.com', 'www.acme.com'];

function answer(
    body: string,
    {
        hops = [{ url, status: 200 }],
        headers = { 'content-type': 'text/html' },
    }: { hops?: Hop[]; headers?: Record<string, string> } = {},
): Fetched {
    const last = hops.at(-1)!;

    return {
        ok: last.status < 400,
        status: last.status,
        url: last.url,
        headers: new Headers(headers),
        body,
        isTruncated: false,
        hops,
        headersMs: 0,
    };
}

function pageOf({
    title = 'Pricing',
    description = 'Two plans for teams.',
    headings = '<h1>Pricing</h1><h2>Team plan</h2>',
    words = 100,
    links = 10,
    head = '',
    origin = 'https://acme.com',
} = {}) {
    const text = Array.from({ length: words }, () => 'word').join(' ');

    const anchors = Array.from(
        { length: links },
        (_, index) => `<a href="${origin}/p${index}/">Page</a>`,
    ).join('');

    return `<html><head><title>${title}</title><meta name="description" content="${description}">${head}</head><body><main>${headings}<p>${text}</p><nav>${anchors}<a href="https://other.com/">Partner</a></nav></main></body></html>`;
}

function reasons(phone: Fetched, desktop = answer(pageOf())) {
    const finding = judgeMobile(url, desktop, phone, hosts);

    return finding === null
        ? null
        : (finding.detail as { reasons: string[] }).reasons;
}

describe('viewportChecks', () => {
    it('reports a page with no viewport meta', () => {
        expect(viewportChecks(url, { viewport: null })).toEqual([
            { check: 'viewport-missing', url },
        ]);
    });

    it('finds nothing in a viewport of device width, read in any case and with semicolons', () => {
        for (const viewport of [
            'width=device-width, initial-scale=1',
            'WIDTH = Device-Width; user-scalable=yes',
            'initial-scale=1,width=device-width,maximum-scale=5',
        ]) {
            expect(viewportChecks(url, { viewport }), viewport).toEqual([]);
        }
    });

    it('reports a viewport with no width, a width in pixels or zoom turned off, with each reason', () => {
        const misconfigured = (viewport: string) =>
            viewportChecks(url, { viewport }).map(({ check, detail }) => [
                check,
                detail,
            ]);

        expect(misconfigured('')).toEqual([
            ['viewport-misconfigured', { content: '', reasons: ['no-width'] }],
        ]);

        expect(misconfigured('initial-scale=1')).toEqual([
            [
                'viewport-misconfigured',
                { content: 'initial-scale=1', reasons: ['no-width'] },
            ],
        ]);

        expect(misconfigured('width=1024px')[0][1]).toEqual({
            content: 'width=1024px',
            reasons: ['numeric-width'],
        });

        expect(misconfigured('width=1024.5, user-scalable=no')[0][1]).toEqual({
            content: 'width=1024.5, user-scalable=no',
            reasons: ['numeric-width', 'not-scalable'],
        });

        expect(
            misconfigured('width=device-width; User-Scalable=0')[0][1],
        ).toMatchObject({ reasons: ['not-scalable'] });
    });
});

describe('judgeMobile', () => {
    it('finds nothing when the phone gets the same page, as from a responsive site', () => {
        expect(
            judgeMobile(url, answer(pageOf()), answer(pageOf()), hosts),
        ).toBe(null);
    });

    it('reports a heading of level 1 to 3 the phone page lacks, by its text in any case and spacing', () => {
        expect(
            reasons(
                answer(
                    pageOf({ headings: '<h1>pricing</h1><h2>Team  plan</h2>' }),
                ),
            ),
        ).toBeNull();

        expect(
            reasons(answer(pageOf({ headings: '<h1>Pricing</h1>' }))),
        ).toEqual(['headings']);

        expect(
            reasons(
                answer(
                    pageOf({ headings: '<h1>Pricing</h1><h2>Team plan</h2>' }),
                ),
                answer(
                    pageOf({
                        headings:
                            '<h1>Pricing</h1><h2>Team plan</h2><h4>Fine print</h4>',
                    }),
                ),
            ),
        ).toBeNull();
    });

    it(`reports a phone page with under ${phoneWordShare * 100}% of the desktop's words`, () => {
        expect(reasons(answer(pageOf({ words: 92 })))).toBeNull();
        expect(reasons(answer(pageOf({ words: 80 })))).toEqual(['words']);
    });

    it(`reports a phone page that lacks over ${missingLinkShare * 100}% of the desktop's internal links`, () => {
        expect(reasons(answer(pageOf({ links: 9 })))).toBeNull();
        expect(reasons(answer(pageOf({ links: 8 })))).toEqual(['links']);
    });

    it("counts a relative link of a separate mobile site as internal and compares the links by path, so the phone page's own host matches the site's", () => {
        const home = 'https://acme.com/';

        const desktop = answer(pageOf({ origin: '' }), {
            hops: [{ url: home, status: 200 }],
        });

        const phone = (links: number) =>
            answer(pageOf({ origin: '', links }), {
                hops: [
                    { url: home, status: 302 },
                    { url: 'https://m.acme.com/', status: 200 },
                ],
            });

        expect(judgeMobile(home, desktop, phone(10), hosts)).toBeNull();

        expect(
            judgeMobile(home, desktop, phone(7), hosts)?.detail,
        ).toMatchObject({ reasons: ['links'] });
    });

    it('reports noindex on the phone page alone, by meta tag or header', () => {
        expect(
            reasons(
                answer(
                    pageOf({ head: '<meta name="robots" content="noindex">' }),
                ),
            ),
        ).toEqual(['noindex']);

        expect(
            reasons(
                answer(pageOf(), {
                    headers: {
                        'content-type': 'text/html',
                        'x-robots-tag': 'none',
                    },
                }),
            ),
        ).toEqual(['noindex']);

        const noindex = pageOf({
            head: '<meta name="robots" content="noindex">',
        });

        expect(reasons(answer(noindex), answer(noindex))).toBeNull();
    });

    it('reports a title or a description that differs, white space aside', () => {
        expect(reasons(answer(pageOf({ title: ' Pricing ' })))).toBeNull();

        expect(
            reasons(
                answer(
                    pageOf({ title: 'Acme', description: 'Plans on a phone.' }),
                ),
            ),
        ).toEqual(['title', 'description']);
    });

    it('compares a phone fetch that redirects at the end of its redirects, with the counts of both sides', () => {
        const mobile = 'https://m.acme.com/pricing';

        const finding = judgeMobile(
            url,
            answer(pageOf()),
            answer(pageOf({ words: 50 }), {
                hops: [
                    { url, status: 302 },
                    { url: mobile, status: 200 },
                ],
            }),
            hosts,
        );

        expect(finding).toEqual({
            check: 'mobile-content-differs',
            url,
            subject: mobile,
            detail: {
                reasons: ['words'],
                desktop: { headings: 2, words: 101, links: 10 },
                phone: { headings: 2, words: 51, links: 10 },
            },
        });
    });

    it('finds nothing when the phone fetch or the desktop fetch does not end on a 200 HTML page', () => {
        const short = answer(pageOf({ words: 1 }));

        for (const phone of [
            answer(pageOf({ words: 1 }), { hops: [{ url, status: 404 }] }),
            answer(pageOf({ words: 1 }), {
                hops: [
                    { url, status: 301 },
                    { url: 'https://m.acme.com/', status: 500 },
                ],
            }),
            answer('%PDF', { headers: { 'content-type': 'application/pdf' } }),
        ]) {
            expect(judgeMobile(url, answer(pageOf()), phone, hosts)).toBeNull();
        }

        expect(
            judgeMobile(
                url,
                answer(pageOf(), { hops: [{ url, status: 503 }] }),
                short,
                hosts,
            ),
        ).toBeNull();
    });
});

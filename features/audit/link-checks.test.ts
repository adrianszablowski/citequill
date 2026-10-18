import { describe, expect, it } from 'vitest';

import {
    anchorFindingsPerPage,
    linkChecks,
    linkCountLimit,
} from '@/features/audit/link-checks';
import { readAuditPage } from '@/features/audit/page';
import { siteHosts } from '@/features/audit/queue';

const url = 'https://acme.com/pricing';

const context = {
    hosts: siteHosts('acme.com', ['https://acme.com']),
    domain: 'acme.com',
};

const menu = '<nav><a href="/">Home</a></nav>';

function findings(body: string, page = url) {
    return linkChecks(
        page,
        readAuditPage(`<html><body>${body}</body></html>`, page),
        context,
    );
}

function checks(body: string) {
    return findings(body).map(({ check, subject }) => [check, subject]);
}

describe('linkChecks', () => {
    it('finds nothing on a page whose links are crawlable, named and specific', () => {
        expect(
            checks(
                `${menu}<a href="/plans">Our plans</a><a href="https://other.com/" rel="nofollow">Other</a><a href="/team"><img src="/t.png" alt="The team"></a><a href="mailto:hi@acme.com">Write to us</a><a href="tel:+48123">Call</a><a href="#top">Back to top</a><a id="faq"></a>`,
            ),
        ).toEqual([]);
    });

    it('reports a link with text or an image and no href, and a javascript: href, never an empty jump target', () => {
        expect(
            checks(
                `${menu}<a>Plans</a><a class="x"><img src="/a.png" alt="A"></a><a href=" JavaScript:go()">Go</a><a name="top"></a><a id="faq"></a>`,
            ),
        ).toEqual([
            ['link-uncrawlable', null],
            ['link-uncrawlable', null],
            ['link-uncrawlable', ' JavaScript:go()'],
        ]);
    });

    it('reports an empty, file, UNC, local or unparsable href, and leaves mailto, tel and fragments alone', () => {
        expect(
            checks(
                `${menu}<a href=" ">a</a><a href="file:///C:/a.pdf">b</a><a href="\\\\server\\share">c</a><a href="http://localhost:3000/x">d</a><a href="https://127.0.0.1/y">e</a><a href="http://[::1]/z">e</a><a href="http://0.0.0.0/w">e</a><a href="http://[bad">f</a><a href="mailto:x">g</a><a href="tel:1">h</a><a href="#a">i</a>`,
            ).filter(([check]) => check === 'link-malformed'),
        ).toEqual([
            ['link-malformed', ' '],
            ['link-malformed', 'file:///C:/a.pdf'],
            ['link-malformed', '\\\\server\\share'],
            ['link-malformed', 'http://localhost:3000/x'],
            ['link-malformed', 'https://127.0.0.1/y'],
            ['link-malformed', 'http://[::1]/z'],
            ['link-malformed', 'http://0.0.0.0/w'],
            ['link-malformed', 'http://[bad'],
        ]);
    });

    it("reports nofollow on a link to the site's own hosts, never on an external one, one under the domain included", () => {
        expect(
            checks(
                `${menu}<a href="/a" rel="NoFollow noopener">a</a><a href="https://www.acme.com/b" rel="nofollow">b</a><a href="https://blog.acme.com/c" rel="nofollow">c</a><a href="https://other.com/" rel="nofollow">d</a>`,
            ),
        ).toEqual([
            ['link-nofollow-internal', '/a'],
            ['link-nofollow-internal', 'https://www.acme.com/b'],
        ]);
    });

    it("reports a generic or bare-URL text on an internal link, an image link's alt included, never on an external one", () => {
        expect(
            checks(
                `${menu}<a href="/a">Read more »</a><a href="/b">https://acme.com/b</a><a href="/c"><img src="/c.png" alt="Czytaj więcej"></a><a href="https://other.com/">click here</a>`,
            ),
        ).toEqual([
            ['anchor-generic', '/a'],
            ['anchor-generic', '/b'],
            ['anchor-generic', '/c'],
        ]);
    });

    it('reports a link with no text and no name, a mailto or tel one included, and takes an aria-label, a title or an alt as its name', () => {
        expect(
            checks(
                `${menu}<a href="/a"><img src="/a.png" alt=""></a><a href="https://other.com/"> </a><a href="/b" aria-label="Basket"><svg></svg></a><a href="/c" title="Cart"></a><a href="mailto:x"></a>`,
            ),
        ).toEqual([
            ['anchor-empty', '/a'],
            ['anchor-empty', 'https://other.com/'],
            ['anchor-empty', 'mailto:x'],
        ]);
    });

    it("reports a page whose only internal links point at itself, its fragments, its trailing-slash twin or a host that is not the site's", () => {
        expect(
            checks(
                `<a href="/pricing">a</a><a href="/pricing/#plans">b</a><a href="https://other.com/">c</a><a href="https://blog.acme.com/">d</a>`,
            ),
        ).toEqual([['page-no-outlinks', undefined]]);

        expect(checks('<a href="https://www.acme.com/">Home</a>')).toEqual([]);
    });

    it(`reports over ${linkCountLimit} links with an href on a page`, () => {
        const links = (count: number) =>
            `${menu}${'<a href="/a">Plans</a>'.repeat(count - 1)}`;

        expect(checks(links(linkCountLimit + 1))).toEqual([
            ['link-count', undefined],
        ]);

        expect(checks(links(linkCountLimit))).toEqual([]);
    });

    it(`reports each distinct href and selector once, ${anchorFindingsPerPage} per check and page at most, with the total in the detail`, () => {
        const generic = Array.from(
            { length: anchorFindingsPerPage + 5 },
            (_, i) => `<a href="/p${i}" class="more">more</a>`,
        ).join('');

        const found = findings(
            `${menu}${generic}<a href="/p0" class="more">more</a><a href="/p0" class="other">more</a>`,
        );

        expect(found).toHaveLength(anchorFindingsPerPage);

        expect(found[0]).toEqual({
            check: 'anchor-generic',
            url,
            subject: '/p0',
            selector: 'a.more',
            snippet: '<a href="/p0" class="more">more</a>',
            detail: { total: anchorFindingsPerPage + 6 },
        });
    });
});

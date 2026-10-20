import { describe, expect, it } from 'vitest';

import { checkText } from '@/features/audit/check-texts';
import { readAuditPage } from '@/features/audit/page';
import { siteHosts } from '@/features/audit/queue';
import { shapeChecks, sourceLabels } from '@/features/audit/shape-checks';

const home = 'https://acme.com/';
const url = 'https://acme.com/blog/red-shoes';
const article = '<meta property="og:type" content="article">';

const context = {
    homes: [home],
    hosts: siteHosts('acme.com', ['https://acme.com']),
    projectName: 'Acme',
    domain: 'acme.com',
};

const words = (count: number, word = 'word') =>
    Array.from({ length: count }, () => word).join(' ');

const answer = `<p>${words(30, 'answer')}</p>`;

function checks(
    body: string,
    {
        head = article,
        title = 'Red shoes',
        at = url,
        site = context,
    }: {
        head?: string;
        title?: string;
        at?: string;
        site?: typeof context;
    } = {},
) {
    const page = readAuditPage(
        `<html><head><title>${title}</title>${head}</head><body>${body}</body></html>`,
        at,
    );

    return shapeChecks(at, page, site);
}

function only(check: string, ...args: Parameters<typeof checks>) {
    return checks(...args).filter((finding) => finding.check === check);
}

describe('shapeChecks, answer-first', () => {
    const first = (...args: Parameters<typeof checks>) =>
        only('answer-first', ...args);

    it('passes an H1 in the header of an article, which the main content leaves out, followed by a long paragraph', () => {
        expect(
            first(
                `<article><header><h1>Red shoes</h1><p>${words(200, 'byline')}</p></header>${answer}<p>${words(300)}</p></article>`,
            ),
        ).toEqual([]);
    });

    it('fails the quarter half when the H1 sits deep in a main element, and gives the counts', () => {
        expect(
            first(
                `<main><p>${words(100, 'intro')}</p><h1>Red shoes</h1>${answer}<p>${words(70)}</p></main>`,
            ),
        ).toEqual([
            {
                check: 'answer-first',
                url,
                detail: {
                    reasons: ['h1-position'],
                    wordsBeforeH1: 100,
                    mainWords: 202,
                    wordsBeforeParagraph: 0,
                },
            },
        ]);
    });

    it('judges the H1 at a quarter of the main words: 25 of 100 or of 101 passes, 26 of 100 fails', () => {
        const at = (before: number, after: number) =>
            first(
                `<main><p>${words(before, 'intro')}</p><h1>Red shoes</h1>${answer}<p>${words(after)}</p></main>`,
            ).map(({ detail }) => detail);

        expect(at(25, 43)).toEqual([]);
        expect(at(25, 44)).toEqual([]);

        expect(at(26, 42)).toEqual([
            {
                reasons: ['h1-position'],
                wordsBeforeH1: 26,
                mainWords: 100,
                wordsBeforeParagraph: 0,
            },
        ]);
    });

    it('does not judge the quarter half when the main content is the body', () => {
        expect(
            first(
                `<div><p>${words(100, 'intro')}</p><h1>Red shoes</h1>${answer}<p>${words(70)}</p></div>`,
            ),
        ).toEqual([]);
    });

    it('fails the paragraph half when a list of 120 words comes between the H1 and the first long paragraph, and not with 99', () => {
        const list = (count: number) =>
            `<ul>${Array.from({ length: count }, () => '<li>item</li>').join('')}</ul>`;

        expect(
            first(`<main><h1>Red shoes</h1>${list(120)}${answer}</main>`),
        ).toEqual([
            {
                check: 'answer-first',
                url,
                detail: {
                    reasons: ['first-paragraph'],
                    wordsBeforeH1: 0,
                    mainWords: 152,
                    wordsBeforeParagraph: 120,
                },
            },
        ]);

        expect(
            first(`<main><h1>Red shoes</h1>${list(99)}${answer}</main>`),
        ).toEqual([]);

        expect(
            first(`<main><h1>Red shoes</h1>${list(100)}${answer}</main>`).map(
                ({ detail }) => detail,
            ),
        ).toEqual([expect.objectContaining({ wordsBeforeParagraph: 100 })]);

        expect(
            first(
                `<main><h1>Red shoes</h1><table><tr><td>${words(120, 'cell')}</td></tr></table>${answer}</main>`,
            ).map(({ detail }) => detail),
        ).toEqual([expect.objectContaining({ reasons: ['first-paragraph'] })]);
    });

    it('places a paragraph the parser moves out of a table after the words of the table, by their offset in the source', () => {
        const table = (cellWords: number) =>
            first(
                `<main><h1>Red shoes</h1><table><tr><td>${words(cellWords, 'cell')}</td></tr><p>${words(25, 'answer')}</p></table></main>`,
            ).map(({ detail }) => detail);

        expect(table(150)).toEqual([
            {
                reasons: ['first-paragraph'],
                wordsBeforeH1: 0,
                mainWords: 177,
                wordsBeforeParagraph: 150,
            },
        ]);

        expect(table(5)).toEqual([]);
    });

    it('passes a short first paragraph followed by a long one within the window', () => {
        expect(
            first(
                `<main><h1>Red shoes</h1><p>${words(10)}</p>${answer}</main>`,
            ),
        ).toEqual([]);
    });

    it('counts a paragraph of exactly 15 words as the answer, and not one of 14', () => {
        const opening = (count: number) =>
            first(
                `<main><h1>Red shoes</h1><p>${words(count)}</p><ul>${'<li>item</li>'.repeat(120)}</ul>${answer}</main>`,
            ).map(({ detail }) => detail);

        expect(opening(15)).toEqual([]);

        expect(opening(14)).toEqual([
            expect.objectContaining({ reasons: ['first-paragraph'] }),
        ]);
    });

    it('fails both halves at once, and the paragraph half when every long paragraph comes before the H1', () => {
        expect(
            first(
                `<main>${answer}<p>${words(30)}</p><h1>Red shoes</h1><p>short</p></main>`,
            ),
        ).toEqual([
            {
                check: 'answer-first',
                url,
                detail: {
                    reasons: ['h1-position', 'first-paragraph'],
                    wordsBeforeH1: 60,
                    mainWords: 63,
                },
            },
        ]);
    });

    it('gives no finding without an H1, without a paragraph of 15 words, or with text only in divs', () => {
        expect(first(`<main>${answer}</main>`)).toEqual([]);

        expect(
            first(
                `<main><p>${words(14)}</p><h1>Red shoes</h1><p>${words(14)}</p></main>`,
            ),
        ).toEqual([]);

        expect(
            first(
                `<main><div>${words(200)}</div><h1>Red shoes</h1><div>${words(200)}</div></main>`,
            ),
        ).toEqual([]);
    });

    it('judges article pages only', () => {
        expect(
            first(
                `<main><h1>Red shoes</h1><ul>${'<li>item</li>'.repeat(120)}</ul>${answer}</main>`,
                {
                    head: '',
                },
            ),
        ).toEqual([]);
    });
});

describe('shapeChecks, one-topic', () => {
    const topic = (
        title: string,
        h1s: string[],
        { head = article, site = context } = {},
    ) =>
        only('one-topic', h1s.map((h1) => `<h1>${h1}</h1>`).join(''), {
            head,
            title,
            site,
        });

    it('matches a word and its inflected form by a shared fragment', () => {
        expect(topic('Buty do biegania | Acme', ['Najlepsze butów'])).toEqual(
            [],
        );
    });

    it('reports a title that shares no fragment with any H1, as compared', () => {
        expect(
            topic('Running shoes | Acme Store', ['Our summer sale', 'Gifts']),
        ).toEqual([
            {
                check: 'one-topic',
                url,
                detail: {
                    comparedTitle: 'running shoes | store',
                    comparedH1s: ['our summer sale', 'gifts'],
                },
            },
        ]);
    });

    it('passes a title that shares a fragment with any H1, so a site name or a slogan in the first H1 does not decide', () => {
        expect(
            topic('Mistakes - by Scott Alexander', [
                'Astral Codex Ten',
                'Mistakes',
            ]),
        ).toEqual([]);

        expect(
            topic('Red shoes review', ['Fun and memes daily', 'Red shoes']),
        ).toEqual([]);
    });

    it('removes the project name and og:site_name from the title and every H1 as whole substrings, so a word of the name stays when the full name is absent', () => {
        const head = `${article}<meta property="og:site_name" content="Acme Store">`;

        expect(topic('Acme | Acme Store', ['Summer sale'], { head })).toEqual(
            [],
        );

        expect(topic('Acme Store', ['Summer sale'], { head })).toEqual([]);

        expect(
            topic('Store hours', ['Contact us'], { head }).map(
                ({ detail }) => detail,
            ),
        ).toEqual([
            { comparedTitle: 'store hours', comparedH1s: ['contact us'] },
        ]);

        expect(
            topic('Spring catalog', ['Acme Store', 'Summer sale'], {
                head,
            }).map(({ detail }) => detail),
        ).toEqual([
            { comparedTitle: 'spring catalog', comparedH1s: ['summer sale'] },
        ]);
    });

    it('removes the domain without www. and its last label, so an H1 that holds only the site name does not count', () => {
        expect(
            topic(
                'Szkolenie z OSINT-u! -- Niebezpiecznik.pl --',
                ['Niebezpiecznik'],
                {
                    site: {
                        ...context,
                        projectName: 'niebezpiecznik.pl',
                        domain: 'niebezpiecznik.pl',
                    },
                },
            ),
        ).toEqual([]);

        expect(
            topic('Trackist | Gym planner', ['Trackist on iPhone'], {
                site: {
                    ...context,
                    projectName: 'Fitness app',
                    domain: 'www.trackist.me',
                },
            }).map(({ detail }) => detail),
        ).toEqual([
            { comparedTitle: '| gym planner', comparedH1s: ['on iphone'] },
        ]);
    });

    it('gives no finding when the title or every H1 has no word of 4 or more characters, or when either is missing', () => {
        expect(topic('Big sale', ['New era'])).toEqual([]);
        expect(topic('Running shoes', ['New era', 'Big day'])).toEqual([]);
        expect(only('one-topic', '<p>No heading</p>')).toEqual([]);

        expect(
            only('one-topic', '<h1>Summer sale</h1>', { title: '' }),
        ).toEqual([]);
    });

    it('reads the words of an H1 split by a br apart', () => {
        expect(topic('Jak żyć dłużej | Acme', ['Jak<br>żyć'])).toEqual([]);
    });

    it('folds full-width letters with NFKC before it compares', () => {
        expect(topic('ＳＨＯＥＳ for runners', ['Shoes'])).toEqual([]);
    });

    it('compares Cyrillic, CJK and supplementary-plane letters by code point', () => {
        expect(topic('Кроссовки для бега', ['Кроссовка'])).toEqual([]);

        expect(topic('Кроссовки для бега', ['Летняя распродажа'])).toHaveLength(
            1,
        );

        expect(topic('東京の天気予報', ['天気予報と気温'])).toEqual([]);
        expect(topic('東京の天気予報', ['大阪のホテル'])).toHaveLength(1);
        expect(topic('𠀋𠀌𠀍', ['𠀎𠀏𠀐'])).toEqual([]);
    });

    it('judges article pages only', () => {
        expect(
            topic('Running shoes | Acme', ['Our summer sale'], { head: '' }),
        ).toEqual([]);
    });
});

describe('shapeChecks, geo-qa-structure', () => {
    const qa = (body: string, head = article) =>
        only('geo-qa-structure', body, { head });

    it('passes a question heading followed by a paragraph, and not one followed by another heading first', () => {
        expect(qa('<main><h2>Why run?</h2><p>Because.</p></main>')).toEqual([]);

        expect(
            qa('<main><h2>Why run?</h2><h3>Reasons</h3><p>Because.</p></main>'),
        ).toEqual([{ check: 'geo-qa-structure', url }]);
    });

    it('counts no question in the H1', () => {
        expect(qa('<main><h1>Why run?</h1><p>Because.</p></main>')).toEqual([
            { check: 'geo-qa-structure', url },
        ]);
    });

    it('reads the full-width and the Arabic question mark', () => {
        expect(qa('<main><h2>なぜ走る？</h2><p>健康。</p></main>')).toEqual([]);

        expect(qa('<main><h3>لماذا الجري؟</h3><p>للصحة.</p></main>')).toEqual(
            [],
        );
    });

    it('reads a question mark followed only by characters that are neither letters nor digits, as anchor links write them', () => {
        expect(
            qa(
                '<main><h2>What is DocSearch?<a class="hash-link" href="#what-is-docsearch">​</a></h2><p>A search service.</p></main>',
            ),
        ).toEqual([]);

        expect(
            qa(
                '<main><h2>Why run?<a class="headerlink" href="#why-run">¶</a></h2><p>Because.</p></main>',
            ),
        ).toEqual([]);

        expect(
            qa(
                '<main><h2>Why run? <a href="#why-run">#</a></h2><p>Because.</p></main>',
            ),
        ).toEqual([]);

        expect(
            qa('<main><h2>Why run? Reasons 2</h2><p>Because.</p></main>'),
        ).toEqual([{ check: 'geo-qa-structure', url }]);
    });

    it('passes a question in a strong or b followed by a paragraph, as Yoast’s FAQ block writes it without FAQPage', () => {
        expect(
            qa(
                '<main><div class="schema-faq-section"><strong class="schema-faq-question">Why run?</strong> <p class="schema-faq-answer">Because.</p></div></main>',
            ),
        ).toEqual([]);

        expect(qa('<main><b>Why run?</b><p>Because.</p></main>')).toEqual([]);

        expect(
            qa('<main><b>Why run?</b><h2>Reasons</h2><p>Because.</p></main>'),
        ).toEqual([{ check: 'geo-qa-structure', url }]);
    });

    it('passes a question in a summary or a dt of the main content', () => {
        expect(
            qa(
                '<main><details><summary>Why run?</summary>Because.</details></main>',
            ),
        ).toEqual([]);

        expect(
            qa('<main><dl><dt>Why run?</dt><dd>Because.</dd></dl></main>'),
        ).toEqual([]);
    });

    it('passes an FAQPage node, also as one of two types of a WebPage', () => {
        const node = (type: unknown) =>
            `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': type })}</script>`;

        const blogPosting = node('BlogPosting');

        expect(
            qa('<main><p>Text.</p></main>', blogPosting + node('FAQPage')),
        ).toEqual([]);

        expect(
            qa(
                '<main><p>Text.</p></main>',
                blogPosting + node(['WebPage', 'FAQPage']),
            ),
        ).toEqual([]);

        expect(
            qa('<main><p>Text.</p></main>', blogPosting + node('QAPage')),
        ).toEqual([]);
    });

    it('counts no question heading in a footer or an aside', () => {
        expect(
            qa(
                '<main><p>Text.</p></main><aside><h2>Questions?</h2><p>Write to us.</p></aside><footer><h2>Questions?</h2><p>Call us.</p></footer>',
            ),
        ).toEqual([{ check: 'geo-qa-structure', url }]);
    });

    it('judges article pages only', () => {
        expect(qa('<main><p>Text.</p></main>', '')).toEqual([]);
    });
});

describe('shapeChecks, geo-source-links', () => {
    const sources = (...hrefs: string[]) =>
        only(
            'geo-source-links',
            `<main><p>Text.</p>${hrefs.map((href) => `<a href="${href}">Source</a>`).join('')}</main>`,
        );

    it('counts a public or academic host of any country', () => {
        for (const href of [
            'https://www.nih.gov/news',
            'https://www.gov.pl/web/zdrowie',
            'https://www.uw.edu.pl/',
            'https://www.service-public.gouv.fr/',
            'https://www.gob.mx/salud',
            'https://www.mhlw.go.jp/',
            'https://www.ox.ac.uk/research',
        ]) {
            expect(sources('https://other.com/', href), href).toEqual([]);
        }
    });

    it('reports a page whose external links reach no such host, a page with none included', () => {
        expect(
            sources(
                'https://go.microsoft.com/fwlink',
                'https://startup.ac/',
                'https://www.bund.de/',
                'https://x.go.com/',
                'https://x.ac.com/',
            ),
        ).toEqual([
            { check: 'geo-source-links', url, detail: { externalLinks: 5 } },
        ]);

        expect(sources()).toEqual([
            { check: 'geo-source-links', url, detail: { externalLinks: 0 } },
        ]);
    });

    it('does not count a link to the site’s own .gov host', () => {
        const page = readAuditPage(
            `<html><head>${article}</head><body><main><a href="https://data.city.gov/report">Report</a></main></body></html>`,
            'https://data.city.gov/blog/post',
        );

        expect(
            shapeChecks('https://data.city.gov/blog/post', page, {
                ...context,
                homes: ['https://data.city.gov/'],
                hosts: siteHosts('data.city.gov', ['https://data.city.gov']),
            }).filter((finding) => finding.check === 'geo-source-links'),
        ).toEqual([
            {
                check: 'geo-source-links',
                url: 'https://data.city.gov/blog/post',
                detail: { externalLinks: 0 },
            },
        ]);
    });

    it('names every label it counts in its text', () => {
        const { says } = checkText('geo-source-links')!;

        for (const label of [
            ...sourceLabels.anywhere,
            ...sourceLabels.beforeCountry,
        ]) {
            expect(says, label).toMatch(new RegExp(`\\b${label}\\b`));
        }
    });
});

describe('shapeChecks, geo-slug', () => {
    const slug = (path: string, site = context) =>
        only('geo-slug', '<p>Text.</p>', {
            at: `https://acme.com${path}`,
            site,
        });

    it('reports a last segment of digits, a UUID or a date', () => {
        for (const [path, segment] of [
            ['/products/12345', '12345'],
            [
                '/orders/3f2504e0-4f89-11d3-9a0c-0305e82c3301/',
                '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
            ],
            ['/news/2024-05-17', '2024-05-17'],
            ['/ebooks/1342', '1342'],
        ]) {
            expect(slug(path), path).toEqual([
                {
                    check: 'geo-slug',
                    url: `https://acme.com${path}`,
                    detail: { segment },
                },
            ]);
        }
    });

    it('leaves out the pages of a list and the date archives', () => {
        for (const path of [
            '/blog/page/2',
            '/blog?page=3',
            '/2024/',
            '/2024/05/',
            '/blog/2024/05/17/',
            '/blog/2024/05/17',
        ]) {
            expect(slug(path), path).toEqual([]);
        }
    });

    it('passes a natural slug and one that starts with digits', () => {
        expect(slug('/blog/red-shoes')).toEqual([]);
        expect(slug('/products/12345-red-shoes')).toEqual([]);
    });

    it('leaves out a home page whose path ends in an identifier', () => {
        expect(slug('/1033/')).toHaveLength(1);

        expect(
            slug('/1033/', {
                ...context,
                homes: [home, 'https://acme.com/1033/'],
            }),
        ).toEqual([]);
    });
});

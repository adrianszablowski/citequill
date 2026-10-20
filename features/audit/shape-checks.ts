import type { Finding } from '@/features/audit/finding';
import type { AuditPage } from '@/features/audit/page';
import type { PageCheckContext } from '@/features/audit/page-checks';
import { externalLinks } from '@/features/audit/resources';
import { isIdentifier } from '@/features/audit/sample';
import { isOfType } from '@/features/audit/structured-data';
import { isDateArchive, pagination } from '@/features/audit/url-patterns';

export const answerFirst = {
    share: 0.25,
    paragraphWords: 15,
    windowWords: 100,
};

export const topicWords = { minLength: 4, fragment: 3 };

export const sourceLabels = {
    anywhere: ['gov', 'edu', 'gouv', 'gob'],
    beforeCountry: ['go', 'ac'],
};

export function shapeChecks(
    url: string,
    page: AuditPage,
    {
        homes,
        hosts,
        projectName,
        domain,
    }: Pick<PageCheckContext, 'homes' | 'hosts' | 'projectName' | 'domain'>,
): Finding[] {
    return [
        ...(page.isArticle
            ? [
                  ...answerFirstFindings(url, page),
                  ...topicFindings(url, page, [
                      projectName,
                      page.siteName ?? '',
                      domainName(domain),
                  ]),
                  ...questionFindings(url, page),
                  ...sourceFindings(url, page, hosts),
              ]
            : []),
        ...(homes.includes(url) ? [] : slugFindings(url)),
    ];
}

function answerFirstFindings(
    url: string,
    { h1s, mainContent }: AuditPage,
): Finding[] {
    const { isLandmark, words, h1, paragraphs } = mainContent;

    const long = paragraphs.filter(
        (paragraph) => paragraph.words >= answerFirst.paragraphWords,
    );

    if (!h1s[0] || !h1 || long.length === 0) {
        return [];
    }

    const wordsBeforeParagraph = long
        .map((paragraph) => paragraph.wordsBefore - h1.wordsThrough)
        .find((gap) => gap >= 0);

    const reasons = [
        ...(isLandmark && h1.wordsBefore > words * answerFirst.share
            ? ['h1-position']
            : []),
        ...(wordsBeforeParagraph === undefined ||
        wordsBeforeParagraph >= answerFirst.windowWords
            ? ['first-paragraph']
            : []),
    ];

    return reasons.length > 0
        ? [
              {
                  check: 'answer-first',
                  url,
                  detail: {
                      reasons,
                      wordsBeforeH1: h1.wordsBefore,
                      mainWords: words,
                      ...(wordsBeforeParagraph !== undefined && {
                          wordsBeforeParagraph,
                      }),
                  },
              },
          ]
        : [];
}

function topicFindings(
    url: string,
    { title, h1s }: AuditPage,
    siteNames: string[],
): Finding[] {
    if (!title) {
        return [];
    }

    const names = siteNames
        .map((name) => normalized(name).trim())
        .filter(Boolean)
        .sort((one, other) => other.length - one.length);

    const compared = (text: string) =>
        collapsed(
            names.reduce(
                (rest, name) => rest.replaceAll(name, ' '),
                normalized(text),
            ),
        );

    const comparedTitle = compared(title);
    const titleFragments = fragmentsOf(comparedTitle);

    const comparedH1s = h1s
        .map(compared)
        .filter((h1) => fragmentsOf(h1).size > 0);

    const sharesFragment = (h1: string) =>
        [...fragmentsOf(h1)].some((fragment) => titleFragments.has(fragment));

    return titleFragments.size > 0 &&
        comparedH1s.length > 0 &&
        !comparedH1s.some(sharesFragment)
        ? [{ check: 'one-topic', url, detail: { comparedTitle, comparedH1s } }]
        : [];
}

function questionFindings(
    url: string,
    { mainContent, structuredData }: AuditPage,
): Finding[] {
    const { headings, bold, terms } = mainContent;

    const hasQuestion =
        [...headings.filter(({ level }) => level >= 2), ...bold].some(
            ({ text, isAnswered }) => isAnswered && isQuestion(text),
        ) ||
        terms.some(isQuestion) ||
        structuredData.nodes.some(
            ({ node }) => isOfType(node, 'FAQPage') || isOfType(node, 'QAPage'),
        );

    return hasQuestion ? [] : [{ check: 'geo-qa-structure', url }];
}

function sourceFindings(
    url: string,
    page: AuditPage,
    hosts: string[],
): Finding[] {
    const links = externalLinks(url, page, hosts);

    return links.some((link) => isSourceHost(new URL(link).hostname))
        ? []
        : [
              {
                  check: 'geo-source-links',
                  url,
                  detail: { externalLinks: links.length },
              },
          ];
}

function slugFindings(url: string): Finding[] {
    const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1);

    return segment &&
        isIdentifier(segment) &&
        pagination(url) === null &&
        !isDateArchive(url)
        ? [{ check: 'geo-slug', url, detail: { segment } }]
        : [];
}

function isSourceHost(host: string) {
    const labels = host.toLowerCase().split('.');
    const [beforeLast, last] = labels.slice(-2);

    return (
        labels.some((label) => sourceLabels.anywhere.includes(label)) ||
        (labels.length > 1 &&
            sourceLabels.beforeCountry.includes(beforeLast) &&
            /^[a-z]{2}$/.test(last))
    );
}

function isQuestion(text: string) {
    return /[?？؟][^\p{L}\p{N}]*$/u.test(text);
}

function domainName(domain: string) {
    return domain
        .replace(/^www\./, '')
        .split('.')
        .slice(0, -1)
        .join('.');
}

function normalized(text: string) {
    return text.normalize('NFKC').toLowerCase();
}

function collapsed(text: string) {
    return text.replace(/\s+/g, ' ').trim();
}

function fragmentsOf(text: string) {
    return new Set(
        text
            .split(/[^\p{L}\p{N}]+/u)
            .map((word) => [...word])
            .filter((letters) => letters.length >= topicWords.minLength)
            .flatMap((letters) =>
                letters
                    .slice(0, letters.length - topicWords.fragment + 1)
                    .map((_, start) =>
                        letters
                            .slice(start, start + topicWords.fragment)
                            .join(''),
                    ),
            ),
    );
}

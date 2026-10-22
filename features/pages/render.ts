import type { Element, Root, RootContent } from 'hast';
import rehypeSanitize, { type Options as Schema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { primaryLanguage } from '@/features/crawl/locales';

export type TocEntry = { id: string; text: string; level: number };

export function renderMarkdown(markdown: string, locale: string) {
    const language = primaryLanguage(locale);

    const labels = Object.hasOwn(footnoteLabels, language)
        ? footnoteLabels[language]
        : footnoteLabels.en;

    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype, {
            footnoteLabel: labels.heading,
            footnoteLabelProperties: {},
            footnoteBackLabel: (reference, rereference) =>
                labels.back(
                    `${reference + 1}${rereference > 1 ? `-${rereference}` : ''}`,
                ),
        })
        .use(demoteTitles)
        .use(prefixFootnoteLabel)
        .use(rehypeSlug)
        .use(rehypeSanitize, schema)
        .use(rehypeStringify);

    const tree = processor.runSync(processor.parse(markdown));

    return {
        html: processor.stringify(tree),
        toc: tocOf(tree),
        wordCount: textOf(tree)
            .split(/\s+/)
            .filter((word) => /[\p{L}\p{N}]/u.test(word)).length,
    };
}

function demoteTitles() {
    return (tree: Root) => {
        for (const element of elementsOf(tree.children)) {
            if (element.tagName === 'h1') {
                element.tagName = 'h2';
            }
        }
    };
}

function prefixFootnoteLabel() {
    return (tree: Root) => {
        for (const element of elementsOf(tree.children)) {
            if (element.properties.id === remarkFootnoteLabel) {
                element.properties.id = footnoteLabelId;
            }

            if (element.properties.ariaDescribedBy) {
                element.properties.ariaDescribedBy = [footnoteLabelId];
            }
        }
    };
}

function tocOf(tree: Root) {
    const body = tree.children.filter(
        (node) => !(node.type === 'element' && node.properties.dataFootnotes),
    );

    return [...elementsOf(body)].flatMap((element): TocEntry[] => {
        const level = headingLevels.indexOf(element.tagName) + 2;

        return level > 1 && typeof element.properties.id === 'string'
            ? [{ id: element.properties.id, text: textOf(element), level }]
            : [];
    });
}

function* elementsOf(nodes: RootContent[]): Generator<Element> {
    for (const node of nodes) {
        if (node.type === 'element') {
            yield node;
            yield* elementsOf(node.children);
        }
    }
}

function textOf(node: Root | RootContent): string {
    if (node.type === 'text') {
        return node.value;
    }

    return 'children' in node ? node.children.map(textOf).join('') : '';
}

const headingLevels = ['h2', 'h3', 'h4', 'h5', 'h6'];

const remarkFootnoteLabel = 'footnote-label';

const footnoteLabelId = 'user-content-footnote-label';

const schema: Schema = {
    tagNames: [
        'a',
        'blockquote',
        'br',
        'code',
        'del',
        'em',
        ...headingLevels,
        'hr',
        'li',
        'ol',
        'p',
        'pre',
        'section',
        'strong',
        'sup',
        'table',
        'tbody',
        'td',
        'th',
        'thead',
        'tr',
        'ul',
    ],
    attributes: {
        a: [
            'href',
            'id',
            'ariaDescribedBy',
            'ariaLabel',
            'dataFootnoteRef',
            'dataFootnoteBackref',
        ],
        code: [['className', /^language-./]],
        ...Object.fromEntries(headingLevels.map((level) => [level, ['id']])),
        li: ['id'],
        ol: ['start'],
        section: ['dataFootnotes'],
        td: ['align'],
        th: ['align'],
    },
    ancestors: {
        tbody: ['table'],
        td: ['table'],
        th: ['table'],
        thead: ['table'],
        tr: ['table'],
    },
    protocols: { href: ['http', 'https', 'mailto', 'tel'] },
    // A customer's site links to a heading as #heading, so the ids keep the
    // form rehype-slug gives them, with no prefix.
    clobberPrefix: '',
    strip: ['script'],
};

interface FootnoteLabels {
    heading: string;
    back: (reference: string) => string;
}

const bokmal: FootnoteLabels = {
    heading: 'Fotnoter',
    back: (reference) => `Tilbake til henvisning ${reference}`,
};

const footnoteLabels: Record<string, FootnoteLabels> = {
    cs: {
        heading: 'Poznámky pod čarou',
        back: (reference) => `Zpět na odkaz ${reference}`,
    },
    da: {
        heading: 'Fodnoter',
        back: (reference) => `Tilbage til henvisning ${reference}`,
    },
    de: {
        heading: 'Fußnoten',
        back: (reference) => `Zurück zum Verweis ${reference}`,
    },
    en: {
        heading: 'Footnotes',
        back: (reference) => `Back to reference ${reference}`,
    },
    es: {
        heading: 'Notas',
        back: (reference) => `Volver a la referencia ${reference}`,
    },
    fi: {
        heading: 'Alaviitteet',
        back: (reference) => `Takaisin viitteeseen ${reference}`,
    },
    fr: {
        heading: 'Notes',
        back: (reference) => `Retour à la référence ${reference}`,
    },
    it: {
        heading: 'Note',
        back: (reference) => `Torna al riferimento ${reference}`,
    },
    nb: bokmal,
    nl: {
        heading: 'Voetnoten',
        back: (reference) => `Terug naar verwijzing ${reference}`,
    },
    no: bokmal,
    pl: {
        heading: 'Przypisy',
        back: (reference) => `Wróć do odwołania ${reference}`,
    },
    pt: {
        heading: 'Notas',
        back: (reference) => `Voltar à referência ${reference}`,
    },
    sk: {
        heading: 'Poznámky pod čiarou',
        back: (reference) => `Späť na odkaz ${reference}`,
    },
    sv: {
        heading: 'Fotnoter',
        back: (reference) => `Tillbaka till hänvisning ${reference}`,
    },
    uk: {
        heading: 'Примітки',
        back: (reference) => `Повернутися до посилання ${reference}`,
    },
};

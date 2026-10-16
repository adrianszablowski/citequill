export const skillFolders = [
    {
        folder: 'product',
        title: 'Product',
        description:
            'Written from the crawl, one skill per topic. Check every line; a skill the crawl found nothing for is yours to fill in.',
    },
    {
        folder: 'kinds',
        title: 'Page kinds',
        description:
            'How to write each kind of page: what it has, in what order, and what done means.',
    },
    {
        folder: 'custom',
        title: 'Custom',
        description:
            'Anything else the model should know about the site, such as a glossary or linking rules.',
    },
] as const;

export type SkillFolder = (typeof skillFolders)[number]['folder'];

export function skillFolder(skill: {
    is_product: boolean;
    page_kinds: unknown[];
}): SkillFolder {
    if (skill.is_product) {
        return 'product';
    }

    return skill.page_kinds.length > 0 ? 'kinds' : 'custom';
}

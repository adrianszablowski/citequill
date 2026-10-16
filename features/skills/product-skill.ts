export const productSkillNames = [
    'What it is',
    'Who it is for',
    'What it does',
    'Plans and prices',
    'Proof',
    'How we speak',
    'What we do not claim',
    'Questions people ask',
    'Languages',
    'Competitors',
] as const;

export type ProductSkillName = (typeof productSkillNames)[number];

export const notFoundOnTheSite = 'Not found on the site.';

export const nothingFoundDescription =
    'The crawl found nothing on the site for this. Fill it in.';

export function sortProductSkills<T extends { name: string }>(skills: T[]) {
    return [...skills].sort((a, b) => rank(a.name) - rank(b.name));
}

function rank(name: string) {
    const index = productSkillNames.findIndex(
        (candidate) => candidate.toLowerCase() === name.trim().toLowerCase(),
    );

    return index === -1 ? productSkillNames.length : index;
}

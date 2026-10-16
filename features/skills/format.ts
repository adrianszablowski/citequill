export interface SkillText {
    name: string;
    description: string;
    body: string;
}

export function renderSkill({ name, description, body }: SkillText) {
    return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body.trim()}\n`;
}

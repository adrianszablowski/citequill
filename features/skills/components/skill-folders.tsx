import { getCurrentUser } from '@/features/auth/queries';
import SkillTile from '@/features/skills/components/skill-tile';
import { skillFolder, skillFolders } from '@/features/skills/folders';
import { sortProductSkills } from '@/features/skills/product-skill';
import { getSkillList } from '@/features/skills/queries';

interface SkillFoldersProps {
    params: Promise<{ id: string }>;
}

export default async function SkillFolders({
    params,
}: Readonly<SkillFoldersProps>) {
    const { id } = await params;

    await getCurrentUser();

    const skills = sortProductSkills(await getSkillList(id));

    return (
        <div className="flex flex-col gap-10">
            {skillFolders.map((folder) => {
                const items = skills.filter(
                    (skill) => skillFolder(skill) === folder.folder,
                );

                return (
                    <section
                        key={folder.folder}
                        className="flex flex-col gap-4"
                    >
                        <div className="flex flex-col gap-1">
                            <h2 className="font-heading text-lg font-medium">
                                {folder.title}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {folder.description}
                            </p>
                        </div>
                        {items.length > 0 && (
                            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {items.map((skill) => (
                                    <li key={skill.id}>
                                        <SkillTile
                                            projectId={id}
                                            skill={skill}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
        </div>
    );
}

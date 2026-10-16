'use server';

import { getCurrentUser } from '@/features/auth/queries';
import { skillSchema, type SkillValues } from '@/features/skills/schema';
import { createClient } from '@/lib/supabase/server';

export async function updateSkill(id: string, values: SkillValues) {
    await getCurrentUser();

    const parsed = skillSchema.safeParse(values);

    if (!parsed.success) {
        return { error: 'Check the skill.' };
    }

    const supabase = await createClient();

    const { error } = await supabase
        .from('skills')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        return { error: error.message };
    }

    return { values: parsed.data };
}

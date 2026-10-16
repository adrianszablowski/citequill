import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export const hasProductSkill = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('skills')
        .select('id')
        .eq('project_id', projectId)
        .eq('is_product', true)
        .limit(1);

    if (error) {
        throw error;
    }

    return data.length > 0;
});

export const getSkillList = cache(async (projectId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('skills')
        .select('id, name, description, is_product, page_kinds(id)')
        .eq('project_id', projectId)
        .order('name');

    if (error) {
        throw error;
    }

    return data;
});

export type SkillListItem = Awaited<ReturnType<typeof getSkillList>>[number];

export const getSkill = cache(async (projectId: string, skillId: string) => {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('skills')
        .select('id, name, description, body, is_product')
        .eq('project_id', projectId)
        .eq('id', skillId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
});

export type Skill = NonNullable<Awaited<ReturnType<typeof getSkill>>>;

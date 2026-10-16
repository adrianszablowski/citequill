'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export async function signInWithGoogle() {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
    });

    if (error || !data.url) {
        redirect('/login?error=google');
    }

    redirect(data.url as Route);
}

export async function signOut() {
    const supabase = await createClient();

    await supabase.auth.signOut();
    redirect('/login');
}

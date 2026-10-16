import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { isAllowedEmail } from '@/features/auth/allowed-emails';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
        redirect('/login?error=google');
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        redirect('/login?error=google');
    }

    if (!isAllowedEmail(data.user.email)) {
        await supabase.auth.signOut();
        redirect('/login?error=not-allowed');
    }

    redirect('/projects');
}

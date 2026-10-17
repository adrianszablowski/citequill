import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { isAllowedEmail } from '@/features/auth/allowed-emails';
import { createClient } from '@/lib/supabase/server';

export const getCurrentUser = cache(async () => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;

    if (!claims) {
        redirect('/login');
    }

    if (!isAllowedEmail(claims.email)) {
        redirect('/login?error=not-allowed');
    }

    return { id: claims.sub, email: claims.email ?? '' };
});

export const isOperator = cache(async () => {
    const { email } = await getCurrentUser();

    // An unset list must stay empty: undefined would fall back to the default
    // list, ALLOWED_EMAILS, and make everyone who signs in the operator.
    return isAllowedEmail(email, process.env.OPERATOR_EMAILS ?? '');
});

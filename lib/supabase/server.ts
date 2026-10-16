import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connection } from 'next/server';

import type { Database } from '@/lib/types/database';

export async function createClient() {
    // The auth client reads Date.now() while loading the session. cookies()
    // alone leaves the caller inside the prerendered app shell, where that
    // read is an error; connection() moves it to request time.
    await connection();

    const cookieStore = await cookies();

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options),
                        );
                    } catch {
                        // A Server Component cannot write cookies; proxy.ts
                        // refreshes the session there, so the write can be
                        // dropped.
                    }
                },
            },
        },
    );
}

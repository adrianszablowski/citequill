import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const publicPaths = ['/login', '/auth/'];

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet, headers) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value),
                    );

                    response = NextResponse.next({ request });

                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options),
                    );

                    Object.entries(headers).forEach(([name, value]) =>
                        response.headers.set(name, value),
                    );
                },
            },
        },
    );

    // getClaims refreshes an expired session and writes the new cookies through
    // setAll. A return before it, or a response built without those cookies,
    // signs the user out at random.
    const { data } = await supabase.auth.getClaims();
    const { pathname } = request.nextUrl;

    const isPublic =
        pathname === '/' ||
        publicPaths.some((path) => pathname.startsWith(path));

    const url = request.nextUrl.clone();

    url.search = '';

    if (!data?.claims && !isPublic) {
        url.pathname = '/login';

        return NextResponse.redirect(url);
    }

    if (data?.claims && pathname === '/') {
        url.pathname = '/projects';

        return NextResponse.redirect(url);
    }

    return response;
}

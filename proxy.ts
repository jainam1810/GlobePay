// Session refresh + coarse route protection. (Next.js renamed middleware.ts
// to proxy.ts.) Fine-grained role checks live in the /admin and /portal
// layouts — here we only keep the session cookie fresh and bounce
// unauthenticated visitors to /login.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return response; // auth not configured yet — let pages explain

    const supabase = createServerClient(url, key, {
        cookies: {
            getAll() { return request.cookies.getAll(); },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            },
        },
    });

    const { data: { user } } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isProtected = path.startsWith("/admin") || path.startsWith("/portal");
    if (isProtected && !user) {
        const login = new URL("/login", request.url);
        login.searchParams.set("next", path);
        return NextResponse.redirect(login);
    }
    if (path === "/login" && user) {
        return NextResponse.redirect(new URL("/route", request.url));
    }
    return response;
}

export const config = {
    matcher: ["/admin/:path*", "/portal/:path*", "/login", "/route"],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const isPublic =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  // Fast path: local JWT verification (no network roundtrip)
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  let authenticated = !claimsError && !!claims;

  // Slow path: access token expired — getUser() refreshes via refresh token.
  // Only run on protected routes to avoid unnecessary network calls on public paths.
  if (!authenticated && !isPublic) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    authenticated = !userError && !!user;
  }

  if (!authenticated && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

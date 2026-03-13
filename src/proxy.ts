import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const MOBILE_UA_RE =
  /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile Safari/i;

const MOBILE_ALLOWED = [
  "/",
  "/mobile",
  "/api",
  "/_next",
  "/favicon",
  "/privacy",
  "/terms-of-service",
];

function isMobileAllowed(pathname: string): boolean {
  return MOBILE_ALLOWED.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ua = request.headers.get("user-agent") ?? "";

  // Redirect mobile UAs on gated routes before running auth
  if (MOBILE_UA_RE.test(ua) && !isMobileAllowed(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/mobile";
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

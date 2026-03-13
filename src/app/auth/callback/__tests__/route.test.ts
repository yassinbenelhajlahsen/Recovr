import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/auth/callback/route";
import { mockSupabase, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/auth/callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
    data: {
      user: {
        id: TEST_USER_ID,
        email: "test@example.com",
        user_metadata: { full_name: "Test User" },
      },
    },
    error: null,
  });
  (prisma.user.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
    onboarding_completed: true,
  });
});

describe("GET /auth/callback", () => {
  it("redirects to auth error page when no code param", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin?error=auth_failed");
  });

  it("redirects to auth error page when exchangeCodeForSession fails", async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: new Error("Token exchange failed"),
    });
    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin?error=auth_failed");
  });

  it("redirects to /onboarding when onboarding_completed is false", async () => {
    (prisma.user.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboarding_completed: false,
    });
    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/onboarding");
  });

  it("redirects to /dashboard when onboarding_completed is true", async () => {
    const res = await GET(makeRequest({ code: "valid-code" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirects to custom next param when onboarding_completed is true", async () => {
    const res = await GET(makeRequest({ code: "valid-code", next: "/progress" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/progress");
  });
});

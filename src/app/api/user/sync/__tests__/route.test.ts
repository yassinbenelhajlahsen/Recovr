import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/user/sync/route";
import { mockUnauthorized, mockAuthorized, mockSupabase, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function makeRequest(body?: unknown) {
  return new Request("http://localhost/api/user/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: TEST_USER_ID, email: "test@example.com" } },
    error: null,
  });
  (prisma.user.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
    onboarding_completed: false,
  });
});

describe("POST /api/user/sync", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 400 when user has no email", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: TEST_USER_ID, email: null } },
      error: null,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/email/i);
  });

  it("returns 200 with onboarding_completed", async () => {
    (prisma.user.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      onboarding_completed: true,
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.onboarding_completed).toBe(true);
  });

  it("passes name from body to upsert create", async () => {
    await POST(makeRequest({ name: "Alice" }));
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ name: "Alice" }),
      }),
    );
  });

  it("returns 500 when prisma throws", async () => {
    (prisma.user.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});

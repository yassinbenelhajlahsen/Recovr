import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/user/delete/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });
const mockAdminClient = {
  auth: { admin: { deleteUser: mockDeleteUser } },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mockAdminClient),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.user.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
  mockDeleteUser.mockResolvedValue({ error: null });
});

describe("DELETE /api/user/delete", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("returns 200 and deletes user from prisma and supabase auth", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: TEST_USER_ID } });
    expect(mockDeleteUser).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns 200 even when supabase admin delete fails", async () => {
    mockDeleteUser.mockResolvedValue({ error: new Error("Admin error") });
    const res = await DELETE();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});

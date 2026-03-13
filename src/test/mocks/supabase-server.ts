import { vi } from "vitest";

export const TEST_USER_ID = "test-user-123";

export const mockSupabase = {
  auth: {
    getClaims: vi.fn().mockResolvedValue({
      data: { claims: { sub: TEST_USER_ID, email: "test@example.com" } },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: TEST_USER_ID } },
      error: null,
    }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: TEST_USER_ID,
          email: "test@example.com",
          user_metadata: { full_name: "Test User" },
        },
      },
      error: null,
    }),
  },
};

export const createClient = vi.fn().mockResolvedValue(mockSupabase);

export function mockUnauthorized() {
  mockSupabase.auth.getClaims.mockResolvedValue({ data: null, error: new Error("Unauthorized") });
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Unauthorized") });
}

export function mockAuthorized() {
  mockSupabase.auth.getClaims.mockResolvedValue({
    data: { claims: { sub: TEST_USER_ID, email: "test@example.com" } },
    error: null,
  });
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: TEST_USER_ID } },
    error: null,
  });
}

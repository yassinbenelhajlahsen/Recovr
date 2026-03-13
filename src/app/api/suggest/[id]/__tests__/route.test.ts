import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/suggest/[id]/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const SUGGESTION_ID = "suggestion-id-1";
const MOCK_SUGGESTION = {
  id: SUGGESTION_ID,
  user_id: TEST_USER_ID,
  title: "Push Day",
  rationale: "Chest and shoulders are recovered",
  exercises: [],
  presets: ["Strength"],
  draft_id: null,
  created_at: new Date("2024-01-15T10:00:00Z"),
};

function makeRequest() {
  return new Request(`http://localhost/api/suggest/${SUGGESTION_ID}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.suggestion.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_SUGGESTION);
});

describe("GET /api/suggest/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: SUGGESTION_ID }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when suggestion not found", async () => {
    (prisma.suggestion.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: SUGGESTION_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when suggestion belongs to another user", async () => {
    (prisma.suggestion.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_SUGGESTION,
      user_id: "other-user-999",
    });
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: SUGGESTION_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 200 with suggestion data and ISO created_at", async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: SUGGESTION_ID }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(SUGGESTION_ID);
    expect(data.title).toBe("Push Day");
    expect(data.created_at).toBe("2024-01-15T10:00:00.000Z");
    expect(data.user_id).toBeUndefined();
  });
});

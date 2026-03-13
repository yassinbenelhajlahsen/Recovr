import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/suggest/history/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

function makeSuggestion(id: string, createdAt: Date) {
  return {
    id,
    title: `Workout ${id}`,
    presets: [],
    draft_id: null,
    created_at: createdAt,
  };
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/suggest/history");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.suggestion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("GET /api/suggest/history", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty suggestions and hasMore: false", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.suggestions).toEqual([]);
    expect(data.hasMore).toBe(false);
  });

  it("returns hasMore: true when there are more items than limit", async () => {
    // Return limit+1 items (default limit=20, so 21 items)
    const items = Array.from({ length: 21 }, (_, i) =>
      makeSuggestion(`s${i}`, new Date(`2024-01-${String(i + 1).padStart(2, "0")}`)),
    );
    (prisma.suggestion.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(items);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.hasMore).toBe(true);
    expect(data.suggestions).toHaveLength(20);
  });

  it("passes cursor to prisma as lt filter", async () => {
    const cursor = "2024-01-15T00:00:00.000Z";
    await GET(makeRequest({ cursor }));
    expect(prisma.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: TEST_USER_ID,
          created_at: { lt: new Date(cursor) },
        }),
      }),
    );
  });

  it("respects custom limit parameter", async () => {
    await GET(makeRequest({ limit: "5" }));
    expect(prisma.suggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 }),
    );
  });
});

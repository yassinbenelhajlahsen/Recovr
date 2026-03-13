import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/suggest/route";
import { mockUnauthorized, mockAuthorized } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { openai, mockAsyncIterable } from "@/lib/openai";
import { getSuggestionState, persistSuggestion } from "@/lib/suggestion";
import { getRecovery } from "@/lib/recovery";

vi.mock("@/lib/suggestion", () => ({
  getSuggestionState: vi.fn().mockResolvedValue({ cooldown: 0, suggestion: null }),
  persistSuggestion: vi.fn().mockResolvedValue("suggestion-db-id"),
}));

vi.mock("@/lib/recovery", () => ({
  getRecovery: vi.fn().mockResolvedValue([
    { muscle: "chest", status: "recovered", recoveryPct: 1.0 },
    { muscle: "back", status: "partial", recoveryPct: 0.6 },
  ]),
}));

const MOCK_SUGGESTION = {
  title: "Push Day",
  rationale: "Chest is recovered",
  exercises: [
    {
      name: "Bench Press",
      muscleGroups: ["chest"],
      sets: [{ reps: 10, weight: 135 }],
    },
  ],
};

const STREAM_JSON = JSON.stringify(MOCK_SUGGESTION);

function makeRequest(body: unknown = {}) {
  return new Request("http://localhost/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function collectNdjson(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();

  (getSuggestionState as ReturnType<typeof vi.fn>).mockResolvedValue({
    cooldown: 0,
    suggestion: null,
  });
  (persistSuggestion as ReturnType<typeof vi.fn>).mockResolvedValue("suggestion-db-id");
  (getRecovery as ReturnType<typeof vi.fn>).mockResolvedValue([
    { muscle: "chest", status: "recovered", recoveryPct: 1.0 },
    { muscle: "back", status: "partial", recoveryPct: 0.6 },
  ]);

  (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    fitness_goals: ["build_muscle"],
    weight_lbs: 175,
    gender: "male",
  });
  (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue(
    mockAsyncIterable([STREAM_JSON]),
  );

  process.env.OPENAI_API_KEY = "test-key";
});

describe("POST /api/suggest", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when OPENAI_API_KEY is not set", async () => {
    const original = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      const res = await POST(makeRequest());
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toMatch(/api key/i);
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });

  it("returns cached JSON response when cooldown is active", async () => {
    (getSuggestionState as ReturnType<typeof vi.fn>).mockResolvedValue({
      cooldown: 1800,
      suggestion: MOCK_SUGGESTION,
      suggestionId: "s-cached",
      draftId: null,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const data = await res.json();
    expect(data._cached).toBe(true);
    expect(data._cooldown).toBe(1800);
    expect(data.title).toBe("Push Day");
  });

  it("includes _draftId and _suggestionId in cached response", async () => {
    (getSuggestionState as ReturnType<typeof vi.fn>).mockResolvedValue({
      cooldown: 1800,
      suggestion: MOCK_SUGGESTION,
      suggestionId: "s-1",
      draftId: "draft-123",
    });

    const res = await POST(makeRequest());
    const data = await res.json();
    expect(data._draftId).toBe("draft-123");
    expect(data._suggestionId).toBe("s-1");
  });

  it("returns 500 when user profile / recovery fetch fails", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DB error"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns 500 when OpenAI create throws", async () => {
    (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("OpenAI down"),
    );
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });

  it("streams NDJSON with meta, title, rationale, exercise, done events", async () => {
    const res = await POST(makeRequest());
    expect(res.headers.get("content-type")).toContain("text/x-ndjson");
    const events = await collectNdjson(res);

    const types = events.map((e) => e.type);
    expect(types).toContain("meta");
    expect(types).toContain("title");
    expect(types).toContain("rationale");
    expect(types).toContain("exercise");
    expect(types).toContain("done");
  });

  it("filters invalid presets from selectedPresets", async () => {
    const res = await POST(makeRequest({ selectedPresets: ["Strength", "InvalidPreset", 42] }));
    // Should not error — invalid presets are filtered, valid ones passed through
    expect([200]).toContain(res.status);
    expect(openai.chat.completions.create).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/workouts/draft/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const MOCK_EXERCISE = { id: "ex-bench", name: "Bench Press", muscle_groups: ["chest"] };

const VALID_SUGGESTION = {
  title: "Push Day",
  rationale: "Recovery-based push session",
  exercises: [
    {
      name: "Bench Press",
      muscleGroups: ["chest"],
      sets: [{ reps: 8, weight: 135 }],
    },
  ],
};

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/workouts/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.exercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_EXERCISE]);
  (prisma.workout.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "draft-workout-1" });
  (prisma.suggestion.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe("POST /api/workouts/draft", () => {
  it("returns 201 with workout id for valid suggestion", async () => {
    const res = await POST(makePostRequest({ suggestion: VALID_SUGGESTION }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("draft-workout-1");
  });

  it("accepts bodyweight exercises with weight: null", async () => {
    const suggestion = {
      ...VALID_SUGGESTION,
      exercises: [
        {
          name: "Bench Press",
          muscleGroups: ["chest"],
          sets: [
            { reps: 6, weight: null },
            { reps: 6, weight: null },
          ],
        },
      ],
    };
    const res = await POST(makePostRequest({ suggestion }));
    expect(res.status).toBe(201);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await POST(makePostRequest({ suggestion: VALID_SUGGESTION }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is null / invalid JSON", async () => {
    const req = new Request("http://localhost/api/workouts/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when suggestion.exercises is not an array", async () => {
    const res = await POST(
      makePostRequest({ suggestion: { ...VALID_SUGGESTION, exercises: "not-array" } }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when suggestion is missing entirely", async () => {
    const res = await POST(makePostRequest({ foo: "bar" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a future date", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const dateStr = future.toISOString().slice(0, 10);
    const res = await POST(makePostRequest({ suggestion: VALID_SUGGESTION, date: dateStr }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/future/i);
  });

  it("resolves exercise via exact match — does not call prisma.exercise.create", async () => {
    const res = await POST(makePostRequest({ suggestion: VALID_SUGGESTION }));
    expect(res.status).toBe(201);
    expect(prisma.exercise.create).not.toHaveBeenCalled();
    // workout.create called with the matched exercise ID
    expect(prisma.workout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          is_draft: true,
          source: "suggested",
          user_id: TEST_USER_ID,
        }),
      }),
    );
  });

  it("calls linkDraftToSuggestion (prisma.suggestion.update) when suggestionId provided", async () => {
    const res = await POST(
      makePostRequest({ suggestion: VALID_SUGGESTION, suggestionId: "sug-id-abc" }),
    );
    expect(res.status).toBe(201);
    expect(prisma.suggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "sug-id-abc" }),
        data: expect.objectContaining({ draft_id: "draft-workout-1" }),
      }),
    );
  });

  it("does not call linkDraftToSuggestion when no suggestionId provided", async () => {
    const res = await POST(makePostRequest({ suggestion: VALID_SUGGESTION }));
    expect(res.status).toBe(201);
    expect(prisma.suggestion.update).not.toHaveBeenCalled();
  });
});

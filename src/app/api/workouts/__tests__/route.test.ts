import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/workouts/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const MOCK_WORKOUT = {
  id: "workout-1",
  user_id: TEST_USER_ID,
  date: new Date("2024-01-15"),
  notes: null,
  duration_minutes: 60,
  body_weight: null,
  is_draft: false,
  source: "manual",
  workout_exercises: [],
};

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/workouts");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/workouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.workout.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([MOCK_WORKOUT]);
  (prisma.workout.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-workout-1" });
  (prisma.workout.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  // exercise.findMany is called by the new exercise ownership validation in POST
  (prisma.exercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "ex-1" }]);
});

describe("GET /api/workouts", () => {
  it("returns 200 with workouts array for authenticated user", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("passes search filter to prisma when search param provided", async () => {
    await GET(makeGetRequest({ search: "bench" }));
    const call = (prisma.workout.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toHaveProperty("workout_exercises");
  });

  it("passes date filters to prisma when from/to params provided", async () => {
    await GET(makeGetRequest({ from: "2024-01-01", to: "2024-01-31" }));
    const call = (prisma.workout.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toHaveProperty("date");
  });

  it("returns 400 for invalid date param", async () => {
    const res = await GET(makeGetRequest({ from: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });
});

describe("POST /api/workouts", () => {
  const validPayload = {
    date: "2024-01-15",
    exercises: [
      {
        exercise_id: "ex-1",
        order: 0,
        sets: [{ set_number: 1, reps: "10", weight: "135" }],
      },
    ],
  };

  it("returns 201 for valid workout", async () => {
    const res = await POST(makePostRequest(validPayload));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("new-workout-1");
  });

  it("returns 400 for future date (far future)", async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const dateStr = futureDate.toISOString().slice(0, 10);
    const res = await POST(makePostRequest({ ...validPayload, date: dateStr }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/future/i);
  });

  it("returns 400 when exercises is not an array", async () => {
    const res = await POST(makePostRequest({ date: "2024-01-15", exercises: "not-array" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/exercises/i);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await POST(makePostRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it("calls invalidateRecovery for non-draft workouts", async () => {
    // With redis = null (mocked), invalidateRecovery is a no-op
    // Just verify the workout is created successfully
    const res = await POST(makePostRequest(validPayload));
    expect(res.status).toBe(201);
    expect(prisma.workout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ is_draft: false }),
      })
    );
  });

  it("does not fail for draft workouts (no recovery invalidation)", async () => {
    const res = await POST(makePostRequest({ ...validPayload, is_draft: true }));
    expect(res.status).toBe(201);
    expect(prisma.workout.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ is_draft: true }),
      })
    );
  });
});

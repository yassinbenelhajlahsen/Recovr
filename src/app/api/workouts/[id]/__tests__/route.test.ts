import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE, PUT } from "@/app/api/workouts/[id]/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const WORKOUT_ID = "workout-id-1";
const OTHER_USER_ID = "other-user-456";

const MOCK_WORKOUT = {
  id: WORKOUT_ID,
  user_id: TEST_USER_ID,
  date: new Date("2024-01-15"),
  notes: null,
  duration_minutes: 60,
  body_weight: null,
  is_draft: false,
  source: "manual",
  workout_exercises: [],
};

function makeRequest(method = "GET", body?: unknown) {
  return new Request(`http://localhost/api/workouts/${WORKOUT_ID}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (prisma.workout.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_WORKOUT);
  (prisma.workout.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: WORKOUT_ID, is_draft: false });
  (prisma.workout.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
});

describe("GET /api/workouts/[id]", () => {
  it("returns 200 with workout when authenticated and user owns it", async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: WORKOUT_ID }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(WORKOUT_ID);
  });

  it("returns 404 when workout belongs to another user", async () => {
    (prisma.workout.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_WORKOUT,
      user_id: OTHER_USER_ID,
    });
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: WORKOUT_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when workout does not exist", async () => {
    (prisma.workout.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: WORKOUT_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: WORKOUT_ID }) });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/workouts/[id]", () => {
  it("returns 200 and updates is_draft when body is valid", async () => {
    const res = await PATCH(makeRequest("PATCH", { is_draft: false }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(prisma.workout.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { is_draft: false } }),
    );
  });

  it("returns 400 when body is missing is_draft boolean", async () => {
    const res = await PATCH(makeRequest("PATCH", { foo: "bar" }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when is_draft is not a boolean (string)", async () => {
    const res = await PATCH(makeRequest("PATCH", { is_draft: "true" }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when workout does not exist", async () => {
    (prisma.workout.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await PATCH(makeRequest("PATCH", { is_draft: false }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await PATCH(makeRequest("PATCH", { is_draft: false }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/workouts/[id]", () => {
  it("returns 200 when authenticated user owns workout", async () => {
    const res = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(prisma.workout.delete).toHaveBeenCalledWith({ where: { id: WORKOUT_ID } });
  });

  it("returns 404 when workout belongs to another user", async () => {
    (prisma.workout.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_WORKOUT,
      user_id: OTHER_USER_ID,
    });
    const res = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(404);
    expect(prisma.workout.delete).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(401);
    expect(prisma.workout.delete).not.toHaveBeenCalled();
  });
});

describe("PUT /api/workouts/[id]", () => {
  const VALID_BODY = {
    date: "2024-01-15",
    notes: "Good session",
    duration_minutes: 60,
    body_weight: null,
    exercises: [
      {
        exercise_id: "ex-1",
        order: 0,
        sets: [{ set_number: 1, reps: "10", weight: "135" }],
      },
    ],
  };

  beforeEach(() => {
    (prisma.workout.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: WORKOUT_ID });
    (prisma.workoutExercise.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.workout.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // exercise.findMany is called by the new exercise ownership validation in PUT
    (prisma.exercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "ex-1" }]);
  });

  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await PUT(makeRequest("PUT", VALID_BODY), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when workout not found", async () => {
    (prisma.workout.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await PUT(makeRequest("PUT", VALID_BODY), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when workout belongs to another user", async () => {
    (prisma.workout.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_WORKOUT,
      user_id: OTHER_USER_ID,
    });
    const res = await PUT(makeRequest("PUT", VALID_BODY), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request(`http://localhost/api/workouts/${WORKOUT_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PUT(req, { params: Promise.resolve({ id: WORKOUT_ID }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid date format", async () => {
    const res = await PUT(makeRequest("PUT", { ...VALID_BODY, date: "not-a-date" }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for future date", async () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const dateStr = futureDate.toISOString().split("T")[0];
    const res = await PUT(makeRequest("PUT", { ...VALID_BODY, date: dateStr }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid reps/weight (NaN)", async () => {
    const res = await PUT(
      makeRequest("PUT", {
        ...VALID_BODY,
        exercises: [{ exercise_id: "ex-1", sets: [{ set_number: 1, reps: "abc", weight: "135" }] }],
      }),
      { params: Promise.resolve({ id: WORKOUT_ID }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid duration_minutes", async () => {
    const res = await PUT(makeRequest("PUT", { ...VALID_BODY, duration_minutes: "not-a-number" }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 200 and calls deleteMany + update", async () => {
    const res = await PUT(makeRequest("PUT", VALID_BODY), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(200);
    expect(prisma.workoutExercise.deleteMany).toHaveBeenCalledWith({ where: { workout_id: WORKOUT_ID } });
    expect(prisma.workout.update).toHaveBeenCalled();
  });

  it("syncs body_weight to user profile when this is the latest workout", async () => {
    (prisma.workout.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: WORKOUT_ID,
      body_weight: 185,
    });
    const res = await PUT(makeRequest("PUT", { ...VALID_BODY, body_weight: 185 }), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { weight_lbs: 185 } }),
    );
  });

  it("returns 500 when prisma throws", async () => {
    (prisma.workoutExercise.deleteMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB error"),
    );
    const res = await PUT(makeRequest("PUT", VALID_BODY), {
      params: Promise.resolve({ id: WORKOUT_ID }),
    });
    expect(res.status).toBe(500);
  });
});

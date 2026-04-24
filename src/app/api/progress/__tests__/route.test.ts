import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/progress/route";
import { mockUnauthorized, mockAuthorized, TEST_USER_ID } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

function makeRequest() {
  return new Request("http://localhost/api/progress");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthorized();
  (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue("OK");
  (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.workout.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("GET /api/progress", () => {
  it("returns 401 when unauthenticated", async () => {
    mockUnauthorized();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with empty arrays when no data exists", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.exercises).toEqual([]);
    expect(data.sessionsByExercise).toEqual({});
    expect(data.bodyWeightHistory).toEqual([]);
  });

  it("returns exercises sorted by sessionCount descending", async () => {
    (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        exercise_id: "ex-1",
        exercise: { id: "ex-1", name: "Bench Press" },
        workout: { date: new Date("2024-01-10") },
        sets: [{ reps: 8, weight: 135 }],
      },
      {
        exercise_id: "ex-2",
        exercise: { id: "ex-2", name: "Squat" },
        workout: { date: new Date("2024-01-11") },
        sets: [{ reps: 5, weight: 185 }],
      },
      {
        exercise_id: "ex-2",
        exercise: { id: "ex-2", name: "Squat" },
        workout: { date: new Date("2024-01-12") },
        sets: [{ reps: 5, weight: 190 }],
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.exercises[0].name).toBe("Squat");
    expect(data.exercises[0].sessionCount).toBe(2);
    expect(data.exercises[1].name).toBe("Bench Press");
    expect(data.exercises[1].sessionCount).toBe(1);
  });

  it("includes body weight history from workouts with body_weight set", async () => {
    (prisma.workout.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { date: new Date("2024-01-10"), body_weight: 175.5 },
      { date: new Date("2024-01-15"), body_weight: 174.0 },
    ]);

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.bodyWeightHistory).toHaveLength(2);
    expect(data.bodyWeightHistory[0].weight).toBe(175.5);
  });

  it("queries workoutExercise with is_draft: false to exclude drafts", async () => {
    await GET(makeRequest());
    const call = (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where.workout).toMatchObject({ is_draft: false });
  });

  it("queries workout with is_draft: false for body weight history", async () => {
    await GET(makeRequest());
    const call = (prisma.workout.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.where).toMatchObject({ is_draft: false });
  });

  it("queries with the authenticated user's id", async () => {
    await GET(makeRequest());
    const weCall = (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(weCall.where.workout).toMatchObject({ user_id: TEST_USER_ID });
  });

  it("returns 500 when prisma throws", async () => {
    (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection failed"),
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("builds sessionsByExercise keyed by exercise_id", async () => {
    (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        exercise_id: "ex-bench",
        exercise: { id: "ex-bench", name: "Bench Press" },
        workout: { date: new Date("2024-01-10") },
        sets: [
          { reps: 8, weight: 135 },
          { reps: 8, weight: 135 },
        ],
      },
    ]);

    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.sessionsByExercise["ex-bench"]).toHaveLength(1);
    expect(data.sessionsByExercise["ex-bench"][0].sets).toHaveLength(2);
  });
});

describe("GET /api/progress cache-aside", () => {
  it("returns cached payload without hitting Prisma when cache is warm", async () => {
    const cached = { exercises: [], sessionsByExercise: {}, bodyWeightHistory: [] };
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cached);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(redis.get).toHaveBeenCalledWith(`progress:${TEST_USER_ID}`);
    expect(prisma.workoutExercise.findMany).not.toHaveBeenCalled();
    expect(prisma.workout.findMany).not.toHaveBeenCalled();
    expect(body).toEqual(cached);
  });

  it("hits Prisma and writes cache on miss", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    (prisma.workoutExercise.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (prisma.workout.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const res = await GET(makeRequest());

    expect(prisma.workoutExercise.findMany).toHaveBeenCalled();
    expect(prisma.workout.findMany).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      `progress:${TEST_USER_ID}`,
      { exercises: [], sessionsByExercise: {}, bodyWeightHistory: [] },
      { ex: 300 },
    );
    expect(res.status).toBe(200);
  });
});

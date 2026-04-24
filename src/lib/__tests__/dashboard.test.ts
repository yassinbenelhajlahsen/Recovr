import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDashboardWorkouts } from "@/lib/dashboard";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const USER_ID = "user-123";

beforeEach(() => {
  vi.clearAllMocks();
  (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue("OK");
  (prisma.workout.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("getDashboardWorkouts", () => {
  it("consults the cache and skips Prisma when unfiltered and cache is warm", async () => {
    const cached = [
      {
        id: "w1",
        date: "2026-04-23T00:00:00.000Z",
        dateFormatted: "Thu, Apr 23, 2026",
        durationMinutes: 45,
        notes: null,
        exerciseNames: ["Bench Press"],
        totalSets: 3,
        isDraft: false,
      },
    ];
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cached);

    const result = await getDashboardWorkouts(USER_ID, {});

    expect(redis.get).toHaveBeenCalledWith(`dashboard:${USER_ID}`);
    expect(prisma.workout.findMany).not.toHaveBeenCalled();
    expect(result).toEqual(cached);
  });

  it("hits Prisma and writes cache when unfiltered and cache is cold", async () => {
    (redis.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await getDashboardWorkouts(USER_ID, {});

    expect(prisma.workout.findMany).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      `dashboard:${USER_ID}`,
      [],
      { ex: 300 },
    );
  });

  it("bypasses the cache entirely when any filter is set (search)", async () => {
    await getDashboardWorkouts(USER_ID, { search: "bench" });

    expect(redis.get).not.toHaveBeenCalled();
    expect(prisma.workout.findMany).toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("bypasses the cache entirely when datePreset is set", async () => {
    await getDashboardWorkouts(USER_ID, { datePreset: "30d" });

    expect(redis.get).not.toHaveBeenCalled();
    expect(prisma.workout.findMany).toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("bypasses the cache entirely when muscles is set", async () => {
    await getDashboardWorkouts(USER_ID, { muscles: "chest,triceps" });

    expect(redis.get).not.toHaveBeenCalled();
    expect(prisma.workout.findMany).toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });
});

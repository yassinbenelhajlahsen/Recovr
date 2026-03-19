import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveExercise } from "@/lib/exerciseMatcher";
import { prisma } from "@/lib/prisma";

const USER_ID = "user-123";

const BASE_EXERCISES = [
  { id: "ex-1", name: "Bench Press", muscle_groups: ["chest"] },
  { id: "ex-2", name: "Squat", muscle_groups: ["quadriceps"] },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveExercise", () => {
  it("returns existing exercise on exact match (case-insensitive), created: false", async () => {
    const exercises = [...BASE_EXERCISES];
    const result = await resolveExercise("bench press", [], exercises, USER_ID);
    expect(result).toEqual({
      id: "ex-1",
      name: "Bench Press",
      muscleGroups: ["chest"],
      created: false,
    });
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it("returns existing exercise on exact match with uppercase input", async () => {
    const exercises = [...BASE_EXERCISES];
    const result = await resolveExercise("SQUAT", [], exercises, USER_ID);
    expect(result.id).toBe("ex-2");
    expect(result.created).toBe(false);
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it("returns existing exercise on fuzzy/substring match (input contains DB name)", async () => {
    const exercises = [...BASE_EXERCISES];
    // "squat" is contained in "barbell squat"
    const result = await resolveExercise("Barbell Squat", [], exercises, USER_ID);
    expect(result.id).toBe("ex-2");
    expect(result.name).toBe("Squat");
    expect(result.created).toBe(false);
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it("returns existing exercise on fuzzy/substring match (DB name contains input)", async () => {
    const exercises = [...BASE_EXERCISES];
    // "bench" is contained in "Bench Press"
    const result = await resolveExercise("bench", [], exercises, USER_ID);
    expect(result.id).toBe("ex-1");
    expect(result.created).toBe(false);
    expect(prisma.exercise.create).not.toHaveBeenCalled();
  });

  it("creates a custom exercise when no match found", async () => {
    (prisma.exercise.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-ex-1" });
    const exercises = [...BASE_EXERCISES];
    const result = await resolveExercise("Tricep Pushdown", ["triceps"], exercises, USER_ID);
    expect(prisma.exercise.create).toHaveBeenCalledWith({
      data: { name: "Tricep Pushdown", muscle_groups: ["triceps"], user_id: USER_ID },
      select: { id: true },
    });
    expect(result).toEqual({
      id: "new-ex-1",
      name: "Tricep Pushdown",
      muscleGroups: ["triceps"],
      created: true,
    });
  });

  it("mutates allExercises on creation so the same name doesn't create a duplicate", async () => {
    (prisma.exercise.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "new-ex-2" });
    const exercises = [...BASE_EXERCISES];

    const r1 = await resolveExercise("Cable Fly", ["chest"], exercises, USER_ID);
    // Second call with same name (case-insensitive) should hit exact match via mutated array
    const r2 = await resolveExercise("cable fly", ["chest"], exercises, USER_ID);

    expect(prisma.exercise.create).toHaveBeenCalledTimes(1);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    expect(r2.id).toBe("new-ex-2");
  });
});

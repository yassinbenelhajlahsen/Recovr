import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logger, withLogging } from "@/lib/logger";
import { getCachedProgress, setCachedProgress } from "@/lib/cache";
import type { PerformedExercise, ExerciseSession, BodyWeightEntry } from "@/types/progress";

export const GET = withLogging(async function GET() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = claims.claims.sub as string;

  try {
    const cached = await getCachedProgress(userId);
    if (cached) {
      return NextResponse.json(cached);
    }

    const [rawSessions, rawBodyWeight] = await Promise.all([
      prisma.workoutExercise.findMany({
        where: { workout: { user_id: userId, is_draft: false } },
        select: {
          exercise_id: true,
          exercise: { select: { id: true, name: true } },
          workout: { select: { date: true } },
          sets: { select: { reps: true, weight: true } },
        },
        orderBy: { workout: { date: "asc" } },
      }),
      prisma.workout.findMany({
        where: { user_id: userId, is_draft: false, body_weight: { not: null } },
        select: { date: true, body_weight: true },
        orderBy: { date: "asc" },
      }),
    ]);

    // Derive distinct exercises and session counts in a single pass
    const exerciseMap = new Map<string, { id: string; name: string; count: number }>();
    for (const we of rawSessions) {
      const entry = exerciseMap.get(we.exercise_id);
      if (entry) {
        entry.count++;
      } else {
        exerciseMap.set(we.exercise_id, { id: we.exercise.id, name: we.exercise.name, count: 1 });
      }
    }

    const exercises: PerformedExercise[] = Array.from(exerciseMap.values())
      .map(({ id, name, count }) => ({ id, name, sessionCount: count }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    const sessionsByExercise: Record<string, ExerciseSession[]> = {};
    for (const we of rawSessions) {
      const id = we.exercise_id;
      if (!sessionsByExercise[id]) sessionsByExercise[id] = [];
      sessionsByExercise[id].push({
        date: we.workout.date.toISOString(),
        sets: we.sets.map((s) => ({ reps: s.reps, weight: s.weight })),
      });
    }

    const bodyWeightHistory: BodyWeightEntry[] = rawBodyWeight.map((w) => ({
      date: w.date.toISOString(),
      weight: w.body_weight!,
    }));

    const payload = { exercises, sessionsByExercise, bodyWeightHistory };
    await setCachedProgress(userId, payload);

    return NextResponse.json(payload);
  } catch (err) {
    logger.error({ err }, "GET /api/progress failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

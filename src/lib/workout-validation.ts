import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MAX_EXERCISES,
  MAX_SETS_PER_EXERCISE,
  MAX_REPS,
  MAX_WEIGHT,
  MAX_DURATION,
  MAX_BODY_WEIGHT,
} from "@/lib/constants";

type RawSet = { reps: unknown; weight: unknown };
type RawExercise = { sets?: unknown[] };

export function validateWorkoutDate(date: unknown): NextResponse | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
  if (parsed >= tomorrow) {
    return NextResponse.json({ error: "Date cannot be in the future" }, { status: 400 });
  }
  return null;
}

export function validateExercises(exercises: unknown[]): NextResponse | null {
  if (exercises.length > MAX_EXERCISES) {
    return NextResponse.json({ error: `Too many exercises (max ${MAX_EXERCISES})` }, { status: 400 });
  }
  for (const ex of exercises as RawExercise[]) {
    if (!Array.isArray(ex.sets)) continue;
    if (ex.sets.length > MAX_SETS_PER_EXERCISE) {
      return NextResponse.json({ error: `Too many sets per exercise (max ${MAX_SETS_PER_EXERCISE})` }, { status: 400 });
    }
    for (const s of ex.sets as RawSet[]) {
      const reps = parseInt(String(s.reps));
      const weight = parseFloat(String(s.weight));
      if (isNaN(reps) || isNaN(weight)) {
        return NextResponse.json({ error: "Reps and weight must be valid numbers" }, { status: 400 });
      }
      if (reps < 0 || weight < 0) {
        return NextResponse.json({ error: "Reps or weight cannot be negative" }, { status: 400 });
      }
      if (reps > MAX_REPS || weight > MAX_WEIGHT) {
        return NextResponse.json({ error: "Reps or weight values are out of range" }, { status: 400 });
      }
    }
  }
  return null;
}

export function parseDuration(
  duration_minutes: unknown,
): { value: number | null; error?: NextResponse } {
  const parsed = duration_minutes ? parseInt(String(duration_minutes)) : null;
  if (parsed !== null && isNaN(parsed)) {
    return { value: null, error: NextResponse.json({ error: "duration_minutes must be a valid number" }, { status: 400 }) };
  }
  if (parsed !== null && (parsed < 1 || parsed > MAX_DURATION)) {
    return { value: null, error: NextResponse.json({ error: `Duration must be between 1 and ${MAX_DURATION} minutes` }, { status: 400 }) };
  }
  return { value: parsed };
}

export function parseBodyWeight(
  body_weight: unknown,
): { value: number | null; error?: NextResponse } {
  const parsed = body_weight != null ? parseFloat(String(body_weight)) : null;
  if (parsed !== null && (isNaN(parsed) || parsed < 1 || parsed > MAX_BODY_WEIGHT)) {
    return { value: null, error: NextResponse.json({ error: `Body weight must be between 1 and ${MAX_BODY_WEIGHT}` }, { status: 400 }) };
  }
  return { value: parsed };
}

export async function syncProfileWeight(
  userId: string,
  workoutId: string,
  bodyWeight: number,
): Promise<void> {
  const latest = await prisma.workout.findFirst({
    where: { user_id: userId, body_weight: { not: null } },
    orderBy: { date: "desc" },
    select: { id: true },
  });
  if (latest && latest.id === workoutId) {
    await prisma.user.update({
      where: { id: userId },
      data: { weight_lbs: Math.round(bodyWeight) },
    });
  }
}

import { prisma } from "@/lib/prisma";
import type { MuscleRecovery } from "@/types/recovery";

export type { MuscleRecovery };

export const MUSCLE_GROUPS = [
  "chest",
  "triceps",
  "shoulders",
  "lower back",
  "hamstrings",
  "glutes",
  "traps",
  "back",
  "biceps",
  "rear shoulders",
  "quadriceps",
  "calves",
  "forearms",
  "core",
  "hip flexors",
  "tibialis",
] as const;

const BASE_RECOVERY_HOURS = 48;
const VOLUME_THRESHOLD = 5000; // lbs — "normal" session volume for a muscle group
const WINDOW_HOURS = 96; // how far back to look for workouts
// Proxy weight (lbs) applied per rep when a set has weight = 0 (bodyweight exercises)
const BODYWEIGHT_PROXY = 75;

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function getStatus(pct: number): MuscleRecovery["status"] {
  if (pct >= 0.85) return "recovered";
  if (pct >= 0.45) return "partial";
  return "fatigued";
}

export async function calculateRecovery(userId: string): Promise<MuscleRecovery[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_HOURS * 60 * 60 * 1000);

  // Fetch all workouts in the last 96 hours with full exercise/set data
  const workouts = await prisma.workout.findMany({
    where: {
      user_id: userId,
      date: { gte: windowStart },
    },
    select: {
      id: true,
      date: true,
      workout_exercises: {
        select: {
          exercise: { select: { name: true, muscle_groups: true, equipment: true } },
          sets: { select: { reps: true, weight: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  // Build per-muscle data: accumulate residual fatigue across all workouts in window.
  // Workouts are ordered desc, so the first time a muscle is encountered = most recent session.
  const muscleData = new Map<
    string,
    {
      recoveryPct: number;
      residualFatigue: number; // accumulated (1 - pct) across all workouts
      lastTrainedAt: string;
      hoursSince: number;
      lastSessionVolume: number;
      lastSessionSets: number;
      lastSessionReps: number;
      lastSessionExercises: string[];
    }
  >();

  for (const workout of workouts) {
    // workout.date is already a Date from Prisma — no need for new Date()
    // Old workouts stored as midnight UTC appear artificially old; shift to noon for accurate recovery
    const workoutTime =
      workout.date.getUTCHours() === 0 &&
      workout.date.getUTCMinutes() === 0 &&
      workout.date.getUTCSeconds() === 0
        ? new Date(workout.date.getTime() + 12 * 60 * 60 * 1000)
        : workout.date;
    const hoursSince = (now.getTime() - workoutTime.getTime()) / (1000 * 60 * 60);

    // Aggregate volume and exercises per muscle group within this workout
    const muscleVolume = new Map<string, number>();
    const muscleSets = new Map<string, number>();
    const muscleReps = new Map<string, number>();
    const muscleExercises = new Map<string, string[]>();

    for (const we of workout.workout_exercises) {
      const { muscle_groups, name, equipment } = we.exercise;
      const isBodyweight = equipment === "bodyweight";
      // Bodyweight + extra weight (e.g. weighted dips): count bodyweight + added weight
      // Bodyweight + no extra weight: count BODYWEIGHT_PROXY
      // Non-bodyweight: count actual weight, or BODYWEIGHT_PROXY if somehow 0
      const exerciseVolume = we.sets.reduce((sum, s) => {
        const effectiveWeight = isBodyweight
          ? BODYWEIGHT_PROXY + s.weight
          : s.weight > 0
            ? s.weight
            : BODYWEIGHT_PROXY;
        return sum + s.reps * effectiveWeight;
      }, 0);
      const exerciseSets = we.sets.length;
      const exerciseReps = we.sets.reduce((sum, s) => sum + s.reps, 0);

      for (const muscle of muscle_groups) {
        // Normalize to lowercase to match MUSCLE_GROUPS keys regardless of DB casing
        const m = muscle.toLowerCase();
        muscleVolume.set(m, (muscleVolume.get(m) ?? 0) + exerciseVolume);
        muscleSets.set(m, (muscleSets.get(m) ?? 0) + exerciseSets);
        muscleReps.set(m, (muscleReps.get(m) ?? 0) + exerciseReps);
        const exList = muscleExercises.get(m) ?? [];
        if (!exList.includes(name)) exList.push(name);
        muscleExercises.set(m, exList);
      }
    }

    // Compute recovery pct per muscle for this workout and accumulate fatigue
    for (const [muscle, volume] of muscleVolume) {
      const volumeFactor = clamp(volume / VOLUME_THRESHOLD, 0.8, 1.5);
      const adjustedHours = BASE_RECOVERY_HOURS * volumeFactor;
      const recoveryPct = clamp(hoursSince / adjustedHours, 0, 1);

      const existing = muscleData.get(muscle);
      // Accumulate residual fatigue: each workout's (1 - pct) adds to the total.
      // Combined pct = 1 - sum(residuals), floored at 0.
      const totalResidualFatigue = (existing?.residualFatigue ?? 0) + (1 - recoveryPct);
      const combinedPct = clamp(1 - totalResidualFatigue, 0, 1);

      muscleData.set(muscle, {
        recoveryPct: combinedPct,
        residualFatigue: totalResidualFatigue,
        // Workouts are desc — first encounter is the most recent session
        lastTrainedAt: existing?.lastTrainedAt ?? workout.date.toISOString(),
        hoursSince: existing?.hoursSince ?? hoursSince,
        lastSessionVolume: existing?.lastSessionVolume ?? (muscleVolume.get(muscle) ?? 0),
        lastSessionSets: existing?.lastSessionSets ?? (muscleSets.get(muscle) ?? 0),
        lastSessionReps: existing?.lastSessionReps ?? (muscleReps.get(muscle) ?? 0),
        lastSessionExercises: existing?.lastSessionExercises ?? (muscleExercises.get(muscle) ?? []),
      });
    }
  }

  // Return all muscle groups, defaulting to fully recovered if untrained
  return MUSCLE_GROUPS.map((muscle) => {
    const data = muscleData.get(muscle);
    if (!data) {
      return {
        muscle,
        recoveryPct: 1,
        status: "recovered" as const,
        lastTrainedAt: null,
        hoursSince: null,
        lastSessionVolume: null,
        lastSessionSets: null,
        lastSessionReps: null,
        lastSessionExercises: [],
      };
    }
    return {
      muscle,
      recoveryPct: data.recoveryPct,
      status: getStatus(data.recoveryPct),
      lastTrainedAt: data.lastTrainedAt,
      hoursSince: data.hoursSince,
      lastSessionVolume: data.lastSessionVolume,
      lastSessionSets: data.lastSessionSets,
      lastSessionReps: data.lastSessionReps,
      lastSessionExercises: data.lastSessionExercises,
    };
  });
}

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProgressClient } from "@/components/progress/ProgressClient";
import type { PerformedExercise, ExerciseSession, BodyWeightEntry } from "@/types/progress";

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) redirect("/auth/signin");

  const userId = claims.claims.sub as string;

  // Fetch distinct exercises, sessions, and body weight history in parallel
  const [rawExercises, rawSessions, rawBodyWeight] = await Promise.all([
    prisma.workoutExercise.findMany({
      where: { workout: { user_id: userId } },
      select: {
        exercise_id: true,
        exercise: { select: { id: true, name: true } },
      },
      distinct: ["exercise_id"],
    }),
    prisma.workoutExercise.findMany({
      where: { workout: { user_id: userId } },
      select: {
        exercise_id: true,
        workout: { select: { date: true } },
        sets: { select: { reps: true, weight: true } },
      },
      orderBy: { workout: { date: "asc" } },
    }),
    prisma.workout.findMany({
      where: { user_id: userId, body_weight: { not: null } },
      select: { date: true, body_weight: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // Count sessions per exercise
  const sessionCounts = rawSessions.reduce<Record<string, number>>(
    (acc, we) => {
      acc[we.exercise_id] = (acc[we.exercise_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const exercises: PerformedExercise[] = rawExercises
    .map((we) => ({
      id: we.exercise.id,
      name: we.exercise.name,
      sessionCount: sessionCounts[we.exercise_id] ?? 0,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);

  // Group sessions by exercise id
  const sessionsByExercise: Record<string, ExerciseSession[]> = {};
  for (const we of rawSessions) {
    const id = we.exercise_id;
    if (!sessionsByExercise[id]) sessionsByExercise[id] = [];
    sessionsByExercise[id].push({
      date: we.workout.date.toISOString(),
      sets: we.sets.map((s) => ({ reps: s.reps, weight: s.weight })),
    });
  }

  return (
    <div className="px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl sm:text-5xl text-primary tracking-tight mb-2">
          Progress
        </h1>
        <p className="text-secondary">
          Track your strength and body weight over time.
        </p>
      </div>
      <ProgressClient
        exercises={exercises}
        sessionsByExercise={sessionsByExercise}
        bodyWeightHistory={rawBodyWeight.map((w): BodyWeightEntry => ({
          date: w.date.toISOString(),
          weight: w.body_weight!,
        }))}
      />
    </div>
  );
}

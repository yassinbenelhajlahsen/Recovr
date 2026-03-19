import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { invalidateExercises, setSuggestionDraftId } from "@/lib/cache";
import { resolveExercise } from "@/lib/exerciseMatcher";
import { validateWorkoutDate } from "@/lib/workout-validation";
import { linkDraftToSuggestion } from "@/lib/suggestion";
import { logger, withLogging } from "@/lib/logger";
import type { WorkoutSuggestion, SuggestedExercise } from "@/types/suggestion";

export const POST = withLogging(async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { suggestion, date, suggestionId } = body as { suggestion: WorkoutSuggestion; date?: string; suggestionId?: string };
  if (!suggestion || !Array.isArray(suggestion.exercises)) {
    return NextResponse.json({ error: "Invalid suggestion" }, { status: 400 });
  }

  // Load all exercises available to this user (global + user-created)
  const allExercises = await prisma.exercise.findMany({
    where: { OR: [{ user_id: null }, { user_id: user.id }] },
    select: { id: true, name: true, muscle_groups: true },
  });

  // Resolve each suggested exercise to a DB exercise ID sequentially to avoid
  // duplicate custom exercise creation if the AI repeats an unknown exercise name.
  const resolvedIds: string[] = [];
  let createdCustomExercise = false;
  for (const ex of suggestion.exercises as SuggestedExercise[]) {
    const result = await resolveExercise(ex.name, ex.muscleGroups, allExercises, user.id);
    resolvedIds.push(result.id);
    if (result.created) createdCustomExercise = true;
  }

  const now = new Date();

  const dateError = validateWorkoutDate(date);
  if (dateError) return dateError;

  const storedDate = date
    ? new Date(`${date}T${now.toISOString().slice(11)}`)
    : now;
  const dateLabel = storedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  try {
    const workout = await prisma.workout.create({
      data: {
        user_id: user.id,
        date: storedDate,
        notes: `Generated from recovery analysis on ${dateLabel}.`,
        is_draft: true,
        source: "suggested",
        workout_exercises: {
          create: suggestion.exercises.map((ex: SuggestedExercise, i: number) => ({
            exercise_id: resolvedIds[i],
            order: i,
            sets: {
              create: ex.sets.map((s, j) => ({
                set_number: j + 1,
                reps: s.reps ?? 0,
                weight: s.weight ?? 0,
              })),
            },
          })),
        },
      },
      select: { id: true },
    });

    if (createdCustomExercise) {
      await invalidateExercises(user.id);
    }

    // Track that a draft was created from the current suggestion (for UI dedup)
    void setSuggestionDraftId(user.id, workout.id);

    // Persist the draft link to the DB Suggestion row
    if (suggestionId) {
      await linkDraftToSuggestion(suggestionId, workout.id, user.id);
    }

    return NextResponse.json({ id: workout.id }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "POST /api/workouts/draft failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

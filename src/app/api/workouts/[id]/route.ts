import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  invalidateRecovery,
  invalidateProgress,
  invalidateDashboard,
  invalidateSuggestionDraftId,
} from "@/lib/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger, withLogging } from "@/lib/logger";
import {
  validateWorkoutDate,
  validateExercises,
  validateNotes,
  parseDuration,
  parseBodyWeight,
  syncProfileWeight,
} from "@/lib/workout-validation";

const WORKOUT_SELECT = {
  id: true,
  user_id: true,
  date: true,
  notes: true,
  duration_minutes: true,
  body_weight: true,
  is_draft: true,
  workout_exercises: {
    orderBy: { order: "asc" as const },
    include: {
      exercise: { select: { id: true, name: true, muscle_groups: true, equipment: true } },
      sets: {
        orderBy: { set_number: "asc" as const },
        select: { id: true, set_number: true, reps: true, weight: true },
      },
    },
  },
};

export const GET = withLogging(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const [{ data: claims, error }, workout] = await Promise.all([
      supabase.auth.getClaims(),
      prisma.workout.findUnique({ where: { id }, select: WORKOUT_SELECT }),
    ]);
    if (error || !claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = claims.claims.sub as string;
    if (!workout || workout.user_id !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { user_id: _, ...safe } = workout;
    return NextResponse.json(safe);
  } catch (err) {
    logger.error({ err }, "GET /api/workouts/[id] failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

export const PUT = withLogging(async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimited = await checkRateLimit(`workouts-update:${user.id}`, 120, 3600);
    if (rateLimited) return rateLimited;

    const existing = await prisma.workout.findUnique({ where: { id } });
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { date, notes, duration_minutes, body_weight, exercises } = body;

    const dateError = validateWorkoutDate(date);
    if (dateError) return dateError;

    const notesError = validateNotes(notes);
    if (notesError) return notesError;

    if (Array.isArray(exercises)) {
      const exercisesError = validateExercises(exercises);
      if (exercisesError) return exercisesError;
    }

    const { value: parsedDuration, error: durationError } = parseDuration(duration_minutes);
    if (durationError) return durationError;

    const { value: parsedBodyWeight, error: bodyWeightError } = parseBodyWeight(body_weight);
    if (bodyWeightError) return bodyWeightError;

    // Verify all submitted exercise IDs belong to this user or are global exercises.
    if (Array.isArray(exercises)) {
      const exerciseIds = exercises.map((ex: { exercise_id: string }) => ex.exercise_id);
      if (exerciseIds.length > 0) {
        const validExercises = await prisma.exercise.findMany({
          where: { id: { in: exerciseIds }, OR: [{ user_id: null }, { user_id: user.id }] },
          select: { id: true },
        });
        if (validExercises.length !== exerciseIds.length) {
          return NextResponse.json({ error: "One or more exercise IDs are invalid" }, { status: 400 });
        }
      }
    }

    // Delete existing workout_exercises (sets cascade)
    await prisma.workoutExercise.deleteMany({ where: { workout_id: id } });

    const workout = await prisma.workout.update({
      where: { id },
      data: {
        date: date && date !== existing.date.toISOString().split("T")[0]
          ? new Date(`${date}T${new Date().toISOString().slice(11)}`)
          : existing.date,
        notes: notes || null,
        duration_minutes: parsedDuration,
        body_weight: parsedBodyWeight !== null ? parsedBodyWeight : null,
        workout_exercises: {
          create: exercises.map((ex: { exercise_id: string; order?: number; sets: { set_number: number; reps: string; weight: string }[] }, i: number) => ({
            exercise_id: ex.exercise_id,
            order: ex.order ?? i,
            sets: {
              create: ex.sets.map((s) => ({
                set_number: s.set_number,
                reps: parseInt(String(s.reps)),
                weight: parseFloat(String(s.weight)),
              })),
            },
          })),
        },
      },
      select: { id: true },
    });

    await Promise.all([
      invalidateRecovery(user.id),
      invalidateProgress(user.id),
      invalidateDashboard(user.id),
      parsedBodyWeight ? syncProfileWeight(user.id, id, parsedBodyWeight) : Promise.resolve(),
    ]);

    return NextResponse.json(workout);
  } catch (err) {
    logger.error({ err }, "PUT /api/workouts/[id] failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

export const PATCH = withLogging(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const [{ data: { user } }, existing] = await Promise.all([
      supabase.auth.getUser(),
      prisma.workout.findUnique({ where: { id } }),
    ]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.is_draft !== "boolean") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    await prisma.workout.update({ where: { id }, data: { is_draft: body.is_draft } });
    // Publishing (false) moves the workout into recovery/progress; un-publishing (true) moves it out.
    // Either way the dashboard list order/content may change.
    if (body.is_draft === false) {
      await Promise.all([
        invalidateRecovery(user.id),
        invalidateProgress(user.id),
        invalidateDashboard(user.id),
      ]);
    } else {
      await invalidateDashboard(user.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /api/workouts/[id] failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

export const DELETE = withLogging(async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const [{ data: { user } }, existing] = await Promise.all([
      supabase.auth.getUser(),
      prisma.workout.findUnique({ where: { id } }),
    ]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.workout.delete({ where: { id } });
    await Promise.all([
      invalidateRecovery(user.id),
      invalidateProgress(user.id),
      invalidateDashboard(user.id),
      invalidateSuggestionDraftId(user.id),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/workouts/[id] failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { invalidateRecovery, invalidateSuggestionDraftId } from "@/lib/cache";
import { logger, withLogging } from "@/lib/logger";

const WORKOUT_INCLUDE = {
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
      prisma.workout.findUnique({ where: { id }, include: WORKOUT_INCLUDE }),
    ]);
    if (error || !claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = claims.claims.sub as string;
    if (!workout || workout.user_id !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(workout);
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
    const [{ data: { user } }, existing] = await Promise.all([
      supabase.auth.getUser(),
      prisma.workout.findUnique({ where: { id } }),
    ]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { date, notes, duration_minutes, body_weight, exercises } = body;

    // Validate date
    if (date) {
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
    }

    // Validate sets
    if (Array.isArray(exercises)) {
      for (const ex of exercises) {
        if (!Array.isArray(ex.sets)) continue;
        for (const s of ex.sets) {
          const reps = parseInt(String(s.reps));
          const weight = parseFloat(String(s.weight));
          if (isNaN(reps) || isNaN(weight)) {
            return NextResponse.json({ error: "Reps and weight must be valid numbers" }, { status: 400 });
          }
        }
      }
    }

    const parsedDuration = duration_minutes ? parseInt(String(duration_minutes)) : null;
    if (parsedDuration !== null && isNaN(parsedDuration)) {
      return NextResponse.json({ error: "duration_minutes must be a valid number" }, { status: 400 });
    }

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
        body_weight: typeof body_weight === "number" && body_weight > 0 ? body_weight : null,
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

    await invalidateRecovery(user.id);

    // Smart sync: update User.weight_lbs only if this is the latest workout with body_weight
    const parsedWeight = typeof body_weight === "number" && body_weight > 0 ? body_weight : null;
    if (parsedWeight) {
      const latest = await prisma.workout.findFirst({
        where: { user_id: user.id, body_weight: { not: null } },
        orderBy: { date: "desc" },
        select: { id: true, body_weight: true },
      });
      if (latest && latest.id === id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { weight_lbs: Math.round(parsedWeight) },
        });
      }
    }

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
    // Publishing a draft (is_draft → false) brings it into the recovery window
    if (body.is_draft === false) {
      await invalidateRecovery(user.id);
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
      invalidateSuggestionDraftId(user.id),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/workouts/[id] failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { invalidateRecovery, invalidateSuggestionDraftId } from "@/lib/cache";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
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
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
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

  // Block future dates (1-day tolerance for timezone differences)
  if (date) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    if (date > tomorrow) {
      return NextResponse.json({ error: "Date cannot be in the future" }, { status: 400 });
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
      duration_minutes: duration_minutes ? parseInt(String(duration_minutes)) : null,
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
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
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
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
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
}

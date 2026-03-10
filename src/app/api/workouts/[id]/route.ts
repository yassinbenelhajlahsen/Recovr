import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const WORKOUT_INCLUDE = {
  workout_exercises: {
    orderBy: { order: "asc" as const },
    include: {
      exercise: true,
      sets: { orderBy: { set_number: "asc" as const } },
    },
  },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, workout] = await Promise.all([
    supabase.auth.getUser(),
    prisma.workout.findUnique({ where: { id }, include: WORKOUT_INCLUDE }),
  ]);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!workout || workout.user_id !== user.id) {
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

  const { date, notes, duration_minutes, exercises } = body;

  // Delete existing workout_exercises (sets cascade)
  await prisma.workoutExercise.deleteMany({ where: { workout_id: id } });

  const workout = await prisma.workout.update({
    where: { id },
    data: {
      date: date ? new Date(date) : existing.date,
      notes: notes || null,
      duration_minutes: duration_minutes ? parseInt(String(duration_minutes)) : null,
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

  return NextResponse.json(workout);
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
  return NextResponse.json({ ok: true });
}

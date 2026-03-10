import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const workouts = await prisma.workout.findMany({
    where: {
      user_id: user.id,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to + "T23:59:59") } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            workout_exercises: {
              some: {
                exercise: { name: { contains: search, mode: "insensitive" } },
              },
            },
          }
        : {}),
    },
    include: {
      workout_exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: { select: { name: true, muscle_groups: true } },
          sets: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(workouts);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { date, notes, duration_minutes, exercises } = body;
  if (!Array.isArray(exercises)) {
    return NextResponse.json({ error: "exercises must be an array" }, { status: 400 });
  }

  const workout = await prisma.workout.create({
    data: {
      user_id: user.id,
      date: date ? new Date(date) : new Date(),
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

  return NextResponse.json(workout, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { invalidateRecovery } from "@/lib/cache";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = claims.claims.sub as string;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const workouts = await prisma.workout.findMany({
    where: {
      user_id: userId,
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
          sets: { select: { id: true, set_number: true, reps: true, weight: true } },
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

  const { date, notes, duration_minutes, body_weight, exercises, is_draft } = body;
  if (!Array.isArray(exercises)) {
    return NextResponse.json({ error: "exercises must be an array" }, { status: 400 });
  }

  // Block future dates (1-day tolerance for timezone differences)
  if (date) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    if (date > tomorrow) {
      return NextResponse.json({ error: "Date cannot be in the future" }, { status: 400 });
    }
  }

  const workout = await prisma.workout.create({
    data: {
      user_id: user.id,
      // Attach current time to date-only strings (avoids midnight UTC storage which skews recovery)
      date: date ? new Date(`${date}T${new Date().toISOString().slice(11)}`) : new Date(),
      notes: notes || null,
      duration_minutes: duration_minutes ? parseInt(String(duration_minutes)) : null,
      body_weight: typeof body_weight === "number" && body_weight > 0 ? body_weight : null,
      is_draft: is_draft === true,
      source: "manual",
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

  // Invalidate recovery cache for non-draft workouts (drafts are excluded from recovery)
  if (is_draft !== true) {
    await invalidateRecovery(user.id);
  }

  // Smart sync: update User.weight_lbs only if this is the latest workout with body_weight (skip for drafts)
  if (is_draft !== true && typeof body_weight === "number" && body_weight > 0) {
    const latest = await prisma.workout.findFirst({
      where: { user_id: user.id, body_weight: { not: null } },
      orderBy: { date: "desc" },
      select: { id: true, body_weight: true },
    });
    if (latest && latest.id === workout.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { weight_lbs: Math.round(body_weight) },
      });
    }
  }

  return NextResponse.json(workout, { status: 201 });
}

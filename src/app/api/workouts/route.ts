import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { invalidateRecovery } from "@/lib/cache";
import { logger, withLogging } from "@/lib/logger";

export const GET = withLogging(async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = claims.claims.sub as string;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (from && isNaN(new Date(from).getTime())) {
    return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
  }
  if (to && isNaN(new Date(to).getTime())) {
    return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
  }

  try {
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
  } catch (err) {
    logger.error({ err }, "GET /api/workouts failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

export const POST = withLogging(async function POST(request: Request) {
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

  // Validate date
  if (date) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 2); // 1-day tolerance
    if (parsed >= tomorrow) {
      return NextResponse.json({ error: "Date cannot be in the future" }, { status: 400 });
    }
  }

  // Validate sets
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

  const parsedDuration = duration_minutes ? parseInt(String(duration_minutes)) : null;
  if (parsedDuration !== null && isNaN(parsedDuration)) {
    return NextResponse.json({ error: "duration_minutes must be a valid number" }, { status: 400 });
  }

  try {
    const workout = await prisma.workout.create({
      data: {
        user_id: user.id,
        date: date ? new Date(`${date}T${new Date().toISOString().slice(11)}`) : new Date(),
        notes: notes || null,
        duration_minutes: parsedDuration,
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
  } catch (err) {
    logger.error({ err }, "POST /api/workouts failed");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
});

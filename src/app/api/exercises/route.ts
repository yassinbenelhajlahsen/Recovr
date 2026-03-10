import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = claims.claims.sub as string;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  type ExerciseRow = {
    id: string;
    name: string;
    muscle_groups: string[];
    equipment: string | null;
    user_id: string | null;
  };

  let exercises: ExerciseRow[];

  if (q) {
    // Use raw SQL so we can do partial ILIKE matching on both name and array elements.
    // EXISTS + unnest lets us check if any muscle group contains the search term.
    exercises = await prisma.$queryRaw<ExerciseRow[]>`
      SELECT id, name, muscle_groups, equipment, user_id
      FROM "Exercise"
      WHERE (user_id IS NULL OR user_id = ${userId}::uuid)
        AND (
          name ILIKE ${"%" + q + "%"}
          OR EXISTS (
            SELECT 1 FROM unnest(muscle_groups) AS mg
            WHERE mg ILIKE ${"%" + q + "%"}
          )
        )
      ORDER BY user_id ASC NULLS FIRST, name ASC
    `;
  } else {
    exercises = await prisma.exercise.findMany({
      where: { OR: [{ user_id: null }, { user_id: userId }] },
      orderBy: [{ user_id: "asc" }, { name: "asc" }],
    });
  }

  return NextResponse.json(exercises);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, muscle_groups, equipment } = body;
  if (!name?.trim() || !Array.isArray(muscle_groups) || muscle_groups.length === 0) {
    return NextResponse.json(
      { error: "name and muscle_groups are required" },
      { status: 400 }
    );
  }

  const exercise = await prisma.exercise.create({
    data: {
      name: name.trim(),
      muscle_groups,
      equipment: equipment?.trim() || null,
      user_id: user.id,
    },
  });

  return NextResponse.json(exercise, { status: 201 });
}

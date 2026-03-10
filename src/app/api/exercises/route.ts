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
  const q = searchParams.get("q") ?? "";

  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ user_id: null }, { user_id: user.id }],
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ user_id: "asc" }, { name: "asc" }],
  });

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

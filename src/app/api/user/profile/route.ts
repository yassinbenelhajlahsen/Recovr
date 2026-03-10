import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = claims.claims.sub as string;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      height_inches: true,
      weight_lbs: true,
      fitness_goals: true,
      onboarding_completed: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const data: Record<string, unknown> = {};

  if ("name" in body) {
    data.name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  }
  if ("height_inches" in body) {
    const v = body.height_inches;
    data.height_inches = typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
  }
  if ("weight_lbs" in body) {
    const v = body.weight_lbs;
    data.weight_lbs = typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
  }
  if ("fitness_goals" in body) {
    const v = body.fitness_goals;
    if (Array.isArray(v)) {
      data.fitness_goals = v
        .filter((g: unknown) => typeof g === "string" && g.trim().length > 0 && g.length <= 100)
        .map((g: string) => g.trim())
        .slice(0, 3);
    } else {
      data.fitness_goals = [];
    }
  }
  if ("onboarding_completed" in body) {
    data.onboarding_completed = body.onboarding_completed === true;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: {
      name: true,
      height_inches: true,
      weight_lbs: true,
      fitness_goals: true,
      onboarding_completed: true,
    },
  });

  return NextResponse.json(updated);
}

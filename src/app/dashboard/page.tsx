import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/DashboardClient";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function resolveDatePreset(preset: string | undefined): { from?: Date; to?: Date } {
  if (!preset) return {};
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  if (preset === "today") return { from: startOfToday, to: endOfToday };
  const daysAgo = (n: number) => new Date(startOfToday.getTime() - n * 86400000);
  if (preset === "week") return { from: daysAgo(6), to: endOfToday };
  if (preset === "month") return { from: daysAgo(29), to: endOfToday };
  if (preset === "3months") return { from: daysAgo(89), to: endOfToday };
  return {};
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; datePreset?: string; muscles?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { search = "", datePreset, muscles: musclesParam } = await searchParams;
  const muscles = musclesParam ? musclesParam.split(",").filter(Boolean) : [];
  const { from, to } = resolveDatePreset(datePreset);

  const [dbUser, workouts] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.workout.findMany({
      where: {
        user_id: user.id,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
        ...(search || muscles.length
          ? {
              workout_exercises: {
                some: {
                  exercise: {
                    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
                    ...(muscles.length ? { muscle_groups: { hasSome: muscles } } : {}),
                  },
                },
              },
            }
          : {}),
      },
      include: {
        workout_exercises: {
          orderBy: { order: "asc" },
          include: {
            exercise: { select: { name: true } },
            sets: { select: { id: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const displayName = dbUser?.name || user.email;

  const serializedWorkouts = workouts.map((w) => ({
    id: w.id,
    date: w.date.toISOString(),
    dateFormatted: formatDate(w.date),
    durationMinutes: w.duration_minutes,
    notes: w.notes,
    exerciseNames: w.workout_exercises.map((we) => we.exercise.name),
    totalSets: w.workout_exercises.reduce((sum, we) => sum + we.sets.length, 0),
  }));

  const hasFilters = !!(search || datePreset || muscles.length);

  return (
    <DashboardClient
      displayName={displayName}
      workouts={serializedWorkouts}
      hasFilters={hasFilters}
    />
  );
}

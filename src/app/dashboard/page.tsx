import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getRecovery } from "@/lib/recovery";

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
  const daysAgo = (n: number) => new Date(startOfToday.getTime() - n * 86400000);
  if (preset === "30d") return { from: daysAgo(29), to: endOfToday };
  if (preset === "90d") return { from: daysAgo(89), to: endOfToday };
  if (preset === "6m") return { from: daysAgo(181), to: endOfToday };
  if (preset === "1y") return { from: daysAgo(364), to: endOfToday };
  return {};
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; datePreset?: string; muscles?: string; draft?: string }>;
}) {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) redirect("/auth/signin");

  const userId = claims.claims.sub as string;
  const userEmail = claims.claims.email as string;

  const { search = "", datePreset, muscles: musclesParam, draft } = await searchParams;
  const muscles = musclesParam ? musclesParam.split(",").filter(Boolean) : [];
  const { from, to } = resolveDatePreset(datePreset);

  const [dbUser, workouts, recovery] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, onboarding_completed: true },
    }),
    prisma.workout.findMany({
      where: {
        user_id: userId,
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
                    AND: [
                      ...(search
                        ? [
                            {
                              OR: [
                                { name: { contains: search, mode: "insensitive" as const } },
                                { muscle_groups: { hasSome: [search.toLowerCase()] } },
                              ],
                            },
                          ]
                        : []),
                      ...(muscles.length
                        ? [{ muscle_groups: { hasSome: muscles } }]
                        : []),
                    ],
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
    getRecovery(userId),
  ]);

  if (dbUser && !dbUser.onboarding_completed) {
    redirect("/onboarding");
  }

  const displayName = dbUser?.name || userEmail;

  const serializedWorkouts = workouts.map((w) => ({
    id: w.id,
    date: w.date.toISOString(),
    dateFormatted: formatDate(w.date),
    durationMinutes: w.duration_minutes,
    notes: w.notes,
    exerciseNames: w.workout_exercises.map((we) => we.exercise.name),
    totalSets: w.workout_exercises.reduce((sum, we) => sum + we.sets.length, 0),
    isDraft: w.is_draft,
  }));

  const hasFilters = !!(search || datePreset || muscles.length);

  return (
    <DashboardClient
      displayName={displayName}
      workouts={serializedWorkouts}
      hasFilters={hasFilters}
      recovery={recovery}
      openDraftId={draft}
    />
  );
}

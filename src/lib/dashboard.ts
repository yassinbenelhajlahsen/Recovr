import { prisma } from "@/lib/prisma";
import { getCachedDashboard, setCachedDashboard } from "@/lib/cache";
import type { DashboardWorkoutsPayload, DashboardFilters } from "@/types/dashboard";

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

export async function getDashboardWorkouts(
  userId: string,
  filters: DashboardFilters,
): Promise<DashboardWorkoutsPayload> {
  const search = filters.search ?? "";
  const muscles = filters.muscles ? filters.muscles.split(",").filter(Boolean) : [];
  const hasFilters = !!(search || filters.datePreset || muscles.length);

  if (!hasFilters) {
    const cached = await getCachedDashboard(userId);
    if (cached) return cached;
  }

  const { from, to } = resolveDatePreset(filters.datePreset);

  const workouts = await prisma.workout.findMany({
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
  });

  const payload: DashboardWorkoutsPayload = workouts.map((w) => ({
    id: w.id,
    date: w.date.toISOString(),
    dateFormatted: formatDate(w.date),
    durationMinutes: w.duration_minutes,
    notes: w.notes,
    exerciseNames: w.workout_exercises.map((we) => we.exercise.name),
    totalSets: w.workout_exercises.reduce((sum, we) => sum + we.sets.length, 0),
    isDraft: w.is_draft,
  }));

  if (!hasFilters) {
    await setCachedDashboard(userId, payload);
  }

  return payload;
}

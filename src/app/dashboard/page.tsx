import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getRecovery } from "@/lib/recovery";
import { getDashboardWorkouts } from "@/lib/dashboard";

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

  const { search, datePreset, muscles, draft } = await searchParams;

  const [dbUser, workouts, recovery] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, onboarding_completed: true },
    }),
    getDashboardWorkouts(userId, { search, datePreset, muscles }),
    getRecovery(userId),
  ]);

  if (dbUser && !dbUser.onboarding_completed) {
    redirect("/onboarding");
  }

  const displayName = dbUser?.name || userEmail;
  const hasFilters = !!(search || datePreset || (muscles && muscles.length));

  return (
    <DashboardClient
      displayName={displayName}
      workouts={workouts}
      hasFilters={hasFilters}
      recovery={recovery}
      openDraftId={draft}
    />
  );
}

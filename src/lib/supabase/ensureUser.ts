import type { User } from "@supabase/supabase-js";

/** Syncs auth user to Prisma DB. Returns onboarding status. */
export async function ensureUserInDb(user: User): Promise<{ onboarding_completed: boolean }> {
  const res = await fetch("/api/user/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? null,
    }),
  });
  const data = await res.json();
  return { onboarding_completed: data.onboarding_completed ?? false };
}

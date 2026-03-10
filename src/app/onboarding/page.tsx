import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) redirect("/auth/signin");

  const userId = claims.claims.sub as string;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboarding_completed: true, name: true },
  });

  if (dbUser?.onboarding_completed) redirect("/");

  return <OnboardingFlow initialName={dbUser?.name ?? ""} />;
}

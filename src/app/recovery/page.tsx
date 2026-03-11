import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getRecovery } from "@/lib/recovery";
import { RecoveryView } from "@/components/recovery/RecoveryView";
import { SuggestionTrigger } from "@/components/recovery/SuggestionTrigger";

export default async function RecoveryPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();

  if (error || !claims) redirect("/auth/signin");

  const userId = claims.claims.sub as string;
  const recovery = await getRecovery(userId);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl text-primary tracking-tight mb-2">
            Recovery
          </h1>
          <p className="text-secondary">
            Your muscle recovery status based on recent workout history.
          </p>
        </div>
        <SuggestionTrigger recovery={recovery} />
      </div>
      <RecoveryView recovery={recovery} />
    </div>
  );
}

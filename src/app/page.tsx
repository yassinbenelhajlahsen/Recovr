import { createClient } from "@/lib/supabase/server";
import { LandingClient } from "@/components/landing/LandingClient";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && !!claims;

  return <LandingClient isAuthenticated={isAuthenticated} />;
}

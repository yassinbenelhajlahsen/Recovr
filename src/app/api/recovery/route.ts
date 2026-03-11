import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRecovery } from "@/lib/recovery";

export async function GET() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = claims.claims.sub as string;

  const recovery = await getRecovery(userId);
  return NextResponse.json(recovery);
}

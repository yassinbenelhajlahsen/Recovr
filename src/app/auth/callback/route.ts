import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const dbUser = await prisma.user.upsert({
        where: { email: data.user.email! },
        update: { id: data.user.id },
        create: {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.full_name ?? null,
        },
        select: { onboarding_completed: true },
      });

      const dest = dbUser.onboarding_completed ? next : "/onboarding";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/signin?error=auth_failed`);
}

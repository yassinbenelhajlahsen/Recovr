import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Delete user data from Prisma DB (cascades handle workouts/sets)
  await prisma.user.delete({ where: { id: user.id } });

  // Delete user from Supabase Auth via admin client (service role)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { error } = await adminClient.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Failed to delete Supabase auth user:", error.message);
  }

  return NextResponse.json({ ok: true });
}
